import { describe, expect, it } from "vitest";
import {
  baselineOffsetEm,
  clamp01,
  displayHeight,
  normalizeRotation,
  normalizedToPdf,
  normalizedToPixels,
  pdfToNormalized,
  pixelsToNormalized,
  pointsToPixels,
  textPlacement,
  visibleToRaw,
} from "./coordinates";

const A4_LANDSCAPE = { width: 841.89, height: 595.28 };

describe("normalized <-> PDF", () => {
  it("flips the Y axis", () => {
    const p = A4_LANDSCAPE;
    expect(normalizedToPdf({ x: 0, y: 0 }, p)).toEqual({ x: 0, y: p.height });
    expect(normalizedToPdf({ x: 1, y: 1 }, p)).toEqual({ x: p.width, y: 0 });
    const mid = normalizedToPdf({ x: 0.5, y: 0.44 }, p);
    expect(mid.x).toBeCloseTo(p.width / 2);
    expect(mid.y).toBeCloseTo(p.height * 0.56);
  });

  it("round-trips", () => {
    const n = { x: 0.37, y: 0.82 };
    const back = pdfToNormalized(normalizedToPdf(n, A4_LANDSCAPE), A4_LANDSCAPE);
    expect(back.x).toBeCloseTo(n.x);
    expect(back.y).toBeCloseTo(n.y);
  });
});

describe("pixels <-> normalized", () => {
  it("gives the same result at any display size", () => {
    const small = pixelsToNormalized({ x: 200, y: 100 }, 400, 200);
    const large = pixelsToNormalized({ x: 600, y: 300 }, 1200, 600);
    expect(small).toEqual(large);
    expect(normalizedToPixels(small, 800, 400)).toEqual({ x: 400, y: 200 });
  });

  it("clamps to the page", () => {
    expect(pixelsToNormalized({ x: -10, y: 5000 }, 400, 200)).toEqual({ x: 0, y: 1 });
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe("scale", () => {
  it("converts points to pixels", () => {
    const p = A4_LANDSCAPE;
    expect(pointsToPixels(28, p, p.width)).toBeCloseTo(28);
    expect(pointsToPixels(28, p, p.width / 2)).toBeCloseTo(14);
  });

  it("keeps the page aspect ratio", () => {
    const p = A4_LANDSCAPE;
    expect(displayHeight(p, 1000)).toBeCloseTo((1000 * p.height) / p.width);
  });
});

describe("text placement", () => {
  const page = { width: 1000, height: 500 };
  const base = {
    nx: 0.5,
    ny: 0.2,
    textWidth: 100,
    fontSize: 20,
    ascent: 0.9,
    descent: 0.2,
  };

  it("computes the baseline offset", () => {
    expect(baselineOffsetEm(0.9, 0.2)).toBeCloseTo(0.85);
    expect(baselineOffsetEm(0.5, 0.5)).toBeCloseTo(0.5);
  });

  it("handles left, center and right alignment", () => {
    expect(textPlacement(page, { ...base, alignment: "left" }).x).toBeCloseTo(500);
    expect(textPlacement(page, { ...base, alignment: "center" }).x).toBeCloseTo(450);
    expect(textPlacement(page, { ...base, alignment: "right" }).x).toBeCloseTo(400);
  });

  it("converts the top of the line box to a PDF baseline", () => {
    // top = 100 from top, baseline = 100 + 20 * 0.85 = 117 from top
    const { y } = textPlacement(page, { ...base, alignment: "left" });
    expect(y).toBeCloseTo(500 - 117);
  });
});

describe("page rotation", () => {
  const raw = { width: 600, height: 400 };

  it("normalizes angles", () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(45)).toBe(0);
  });

  it("leaves unrotated pages unchanged", () => {
    expect(visibleToRaw({ x: 10, y: 20 }, raw, 0)).toEqual({ x: 10, y: 20, angle: 0 });
  });

  it("maps visible corners for 90 degrees", () => {
    // Visible page is 400 wide and 600 high.
    expect(visibleToRaw({ x: 0, y: 0 }, raw, 90)).toEqual({ x: 600, y: 0, angle: 90 });
    expect(visibleToRaw({ x: 0, y: 600 }, raw, 90)).toEqual({ x: 0, y: 0, angle: 90 });
  });

  it("maps visible corners for 180 degrees", () => {
    expect(visibleToRaw({ x: 0, y: 0 }, raw, 180)).toEqual({ x: 600, y: 400, angle: 180 });
  });

  it("maps visible corners for 270 degrees", () => {
    expect(visibleToRaw({ x: 0, y: 0 }, raw, 270)).toEqual({ x: 0, y: 400, angle: 270 });
    expect(visibleToRaw({ x: 400, y: 0 }, raw, 270)).toEqual({ x: 0, y: 0, angle: 270 });
  });
});