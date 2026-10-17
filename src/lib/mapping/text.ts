export type TextCase = "none" | "upper" | "title";

// Builds the regex at runtime so it works with any TypeScript target.
const TITLE_CASE = new RegExp("(^|[\\s\\-(])(\\p{L})", "gu");

export function applyTextCase(text: string, textCase: TextCase): string {
  if (textCase === "upper") return text.toUpperCase();
  if (textCase === "title") {
    return text
      .toLowerCase()
      .replace(TITLE_CASE, (_m, prefix: string, ch: string) => prefix + ch.toUpperCase());
  }
  return text;
}

// Shrinks the font size so text fits a maximum width. Never grows the text.
export function fitFontSize(
  fontSize: number,
  textWidth: number,
  maxWidth: number | null,
  minSize = 6
): number {
  if (maxWidth === null || textWidth <= 0 || textWidth <= maxWidth) return fontSize;
  return Math.max(minSize, (fontSize * maxWidth) / textWidth);
}