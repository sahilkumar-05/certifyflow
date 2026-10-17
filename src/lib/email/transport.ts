import nodemailer from "nodemailer";
import { SmtpHostError, resolvePublicHost } from "./network";

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
};

// Connects to the resolved IP and checks the TLS certificate against the real host name.
export async function createSmtpTransport(settings: SmtpSettings) {
  const ip = await resolvePublicHost(settings.host);

  return nodemailer.createTransport({
    host: ip,
    port: settings.port,
    secure: settings.secure,
    // Without SSL from the start, the connection must be upgraded with STARTTLS
    // before the password is sent.
    requireTLS: !settings.secure,
    auth: { user: settings.username, pass: settings.password },
    tls: { servername: settings.host, minVersion: "TLSv1.2" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    logger: false,
    debug: false,
  });
}

// Turns a nodemailer error into a message that is safe to show to the user.
export function describeSmtpError(err: unknown): string {
  if (err instanceof SmtpHostError) return err.message;

  const e = err as { code?: string; responseCode?: number } | null;
  const code = e?.code ?? "";
  const responseCode = e?.responseCode ?? 0;

  if (code === "EAUTH" || [530, 534, 535].includes(responseCode)) {
    return "Authentication failed. Check the username and password. Gmail needs an App Password, not your normal password.";
  }
  if (code === "ETLS") {
    return "A secure (TLS) connection could not be established. Try port 587 with STARTTLS, or port 465 with SSL/TLS.";
  }
  if (code === "EENVELOPE") {
    return "The server rejected the sender or recipient address.";
  }
  if (
    [
      "ETIMEDOUT",
      "ECONNECTION",
      "ESOCKET",
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EDNS",
      "EHOSTUNREACH",
    ].includes(code)
  ) {
    return "Could not connect to the SMTP server. Check the host, the port and the SSL/TLS setting.";
  }
  if (responseCode >= 400) {
    return "The SMTP server rejected the request.";
  }
  return "The email could not be sent. Please check the SMTP settings.";
}