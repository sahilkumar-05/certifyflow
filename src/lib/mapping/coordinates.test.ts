import { describe, expect, it } from "vitest";
import {
  baselineOffsetEm,
  clamp01,
  displayHeight,
  normalizedToPdf,
  normalizedToPixels,
  pdfToNormalized,
  pixelsToNormalized,
  pointsToPixels,
  textPlacement,
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