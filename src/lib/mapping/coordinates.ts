// Coordinate system used by the editor and the PDF generator.
//
// Stored (normalized) coordinates:
//   x, y are between 0 and 1, measured from the TOP-LEFT of the page
//   (browser style), relative to the original PDF page size.
//
// PDF coordinates:
//   points, measured from the BOTTOM-LEFT of the page.
//
// Text anchor:
//   y is the top of the text line box (line-height = 1 em).
//   x is the left edge, center, or right edge of the text, depending
//   on the alignment.

export type PageSize = { width: number; height: number };
export type Point = { x: number; y: number };
export type Alignment = "left" | "center" | "right";

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

// Height in pixels of the page when it is displayed `displayWidth` pixels wide.
export function displayHeight(page: PageSize, displayWidth: number): number {
  return (displayWidth * page.height) / page.width;
}

// Converts PDF points (for example a font size) to screen pixels.
export function pointsToPixels(
  points: number,
  page: PageSize,
  displayWidth: number
): number {
  return (points * displayWidth) / page.width;
}

export function normalizedToPixels(n: Point, width: number, height: number): Point {
  return { x: n.x * width, y: n.y * height };
}

// Clamped to the page, so a field cannot be dragged outside it.
export function pixelsToNormalized(p: Point, width: number, height: number): Point {
  return { x: clamp01(p.x / width), y: clamp01(p.y / height) };
}

export function normalizedToPdf(n: Point, page: PageSize): Point {
  return { x: n.x * page.width, y: page.height * (1 - n.y) };
}

export function pdfToNormalized(p: Point, page: PageSize): Point {
  return { x: clamp01(p.x / page.width), y: clamp01(1 - p.y / page.height) };
}

// Distance from the top of a line box (line-height = 1 em) to the text baseline,
// in em. `ascent` and `descent` are positive fractions of the font size.
export function baselineOffsetEm(ascent: number, descent: number): number {
  return 0.5 + (ascent - descent) / 2;
}

export type TextPlacementInput = {
  nx: number;
  ny: number;
  alignment: Alignment;
  textWidth: number; // points
  fontSize: number; // points
  ascent: number; // em
  descent: number; // em
};

// Returns the PDF coordinates to pass to page.drawText().
export function textPlacement(page: PageSize, input: TextPlacementInput): Point {
  const topFromTop = input.ny * page.height;
  const baselineFromTop =
    topFromTop + input.fontSize * baselineOffsetEm(input.ascent, input.descent);

  let x = input.nx * page.width;
  if (input.alignment === "center") x -= input.textWidth / 2;
  else if (input.alignment === "right") x -= input.textWidth;

  return { x, y: page.height - baselineFromTop };
}