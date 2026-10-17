// Shared by the browser editor and the server PDF generator.
// Each entry is one font file, so "bold" is a separate font instead of a CSS weight.
export const FONTS = [
  { id: "OpenSans", label: "Open Sans", file: "open-sans-latin-400-normal.woff" },
  { id: "OpenSansBold", label: "Open Sans Bold", file: "open-sans-latin-700-normal.woff" },
  { id: "Montserrat", label: "Montserrat", file: "montserrat-latin-400-normal.woff" },
  { id: "MontserratBold", label: "Montserrat Bold", file: "montserrat-latin-700-normal.woff" },
  { id: "PlayfairDisplay", label: "Playfair Display", file: "playfair-display-latin-400-normal.woff" },
  { id: "PlayfairDisplayBold", label: "Playfair Display Bold", file: "playfair-display-latin-700-normal.woff" },
  { id: "Lora", label: "Lora", file: "lora-latin-400-normal.woff" },
  { id: "LoraBold", label: "Lora Bold", file: "lora-latin-700-normal.woff" },
  { id: "GreatVibes", label: "Great Vibes (script)", file: "great-vibes-latin-400-normal.woff" },
] as const;

export type FontId = (typeof FONTS)[number]["id"];

export const FONT_IDS = FONTS.map((f) => f.id) as [FontId, ...FontId[]];

export const DEFAULT_FONT_ID: FontId = "OpenSans";

export function getFont(id: string) {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

// CSS for the browser. The font-family name is the font id.
export function fontFaceCss(): string {
  return FONTS.map(
    (f) =>
      `@font-face{font-family:"${f.id}";src:url("/fonts/${f.file}") format("woff");font-display:block;}`
  ).join("\n");
}