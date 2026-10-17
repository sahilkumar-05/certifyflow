import dns from "node:dns/promises";
import net from "node:net";

// Errors of this type have messages that are safe to show to the user.
export class SmtpHostError extends Error {}

function isPrivateV4(address: string): boolean {
  const [a, b, c] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateV6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true;

  const mappedV4 = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedV4) return isPrivateV4(mappedV4[1]);

  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }

  return (
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    /^fe[89ab]/.test(lower)
  );
}

// True for loopback, private, link-local and other internal addresses.
export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isPrivateV4(address);
  if (family === 6) return isPrivateV6(address);
  return true; // not an IP address: treat as unsafe
}

// Resolves the host and returns an IP address that is safe to connect to.
// Connecting to this IP (instead of the name) prevents DNS rebinding.
export async function resolvePublicHost(host: string): Promise<string> {
  const allowPrivate = process.env.ALLOW_PRIVATE_SMTP === "true";

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      const results = await dns.lookup(host, { all: true });
      addresses = results.map((r) => r.address);
    } catch {
      throw new SmtpHostError("The SMTP host name could not be found.");
    }
  }

  if (addresses.length === 0) {
    throw new SmtpHostError("The SMTP host name could not be found.");
  }
  if (!allowPrivate && addresses.some(isPrivateAddress)) {
    throw new SmtpHostError("This SMTP host is not allowed.");
  }

  return addresses.find((a) => net.isIP(a) === 4) ?? addresses[0];
}