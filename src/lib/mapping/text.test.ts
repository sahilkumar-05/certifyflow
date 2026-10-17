import { describe, expect, it } from "vitest";
import { applyTextCase, fitFontSize } from "./text";

describe("applyTextCase", () => {
  it("leaves text alone", () => {
    expect(applyTextCase("sahil KUMAR", "none")).toBe("sahil KUMAR");
  });

  it("uppercases", () => {
    expect(applyTextCase("ref 001", "upper")).toBe("REF 001");
  });

  it("title-cases names", () => {
    expect(applyTextCase("sahil KUMAR", "title")).toBe("Sahil Kumar");
    expect(applyTextCase("anne-marie o'brien", "title")).toBe("Anne-Marie O'brien");
  });
});

describe("fitFontSize", () => {
  it("keeps the size when the text fits", () => {
    expect(fitFontSize(28, 200, 400)).toBe(28);
    expect(fitFontSize(28, 800, null)).toBe(28);
  });

  it("shrinks proportionally", () => {
    expect(fitFontSize(28, 800, 400)).toBeCloseTo(14);
  });

  it("never goes below the minimum", () => {
    expect(fitFontSize(28, 10000, 100)).toBe(6);
  });
});