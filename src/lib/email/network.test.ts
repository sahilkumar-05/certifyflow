import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./network";

describe("isPrivateAddress", () => {
  it("blocks internal IPv4 addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4 addresses", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "142.250.80.109"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("blocks internal IPv6 addresses", () => {
    for (const ip of [
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6 addresses", () => {
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("treats non-IP values as unsafe", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});