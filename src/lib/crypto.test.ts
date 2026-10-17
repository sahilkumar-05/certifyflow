import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const original = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterEach(() => {
  process.env.ENCRYPTION_KEY = original;
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips, including unicode", () => {
    const secret = "p@ss w0rd: \u00e9\u00f1 123";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("never stores the plain text and uses a new IV each time", () => {
    const a = encryptSecret("my-password");
    const b = encryptSecret("my-password");
    expect(a).not.toContain("my-password");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
  });

  it("rejects tampered data", () => {
    const parts = encryptSecret("my-password").split(":");
    parts[2] = Buffer.alloc(16).toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("rejects a different key", () => {
    const encrypted = encryptSecret("my-password");
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("rejects a missing or short key", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow();
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x")).toThrow();
  });

  it("rejects unknown formats", () => {
    expect(() => decryptSecret("plain-text")).toThrow();
  });
});