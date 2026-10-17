import fs from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";
import { getFont, type FontId } from "@/lib/fonts";

// Fonts are read from public/fonts, the same files the browser editor loads.
const FONT_DIR = path.join(process.cwd(), "public", "fonts");

export type LoadedFont = {
  pdfFont: PDFFont;
  // Positive fractions of the font size (em).
  ascent: number;
  descent: number;
  supports: (codePoint: number) => boolean;
};

type Metrics = { ascent: number; descent: number; chars: Set<number> };

type FontkitFont = { ascent: number; descent: number; unitsPerEm: number };

const bytesCache = new Map<string, Promise<Uint8Array>>();
const metricsCache = new Map<FontId, Metrics>();

function readFontBytes(file: string): Promise<Uint8Array> {
  let promise = bytesCache.get(file);
  if (!promise) {
    promise = fs
      .readFile(path.join(FONT_DIR, file))
      .then((b) => new Uint8Array(b));
    bytesCache.set(file, promise);
    promise.catch(() => bytesCache.delete(file));
  }
  return promise;
}

// Embeds the requested fonts into a document (only the glyphs that are used are kept).
export async function embedFonts(
  doc: PDFDocument,
  ids: FontId[]
): Promise<Map<FontId, LoadedFont>> {
  const out = new Map<FontId, LoadedFont>();

  for (const id of ids) {
    const info = getFont(id);
    const bytes = await readFontBytes(info.file);
    const pdfFont = await doc.embedFont(bytes, { subset: true });

    let metrics = metricsCache.get(id);
    if (!metrics) {
      // hhea ascent/descent from the font file, the same values the browser uses.
      const fk = fontkit.create(bytes) as unknown as FontkitFont;
      metrics = {
        ascent: fk.ascent / fk.unitsPerEm,
        descent: Math.abs(fk.descent) / fk.unitsPerEm,
        chars: new Set(pdfFont.getCharacterSet()),
      };
      metricsCache.set(id, metrics);
    }

    const chars = metrics.chars;
    out.set(id, {
      pdfFont,
      ascent: metrics.ascent,
      descent: metrics.descent,
      supports: (cp) => chars.has(cp),
    });
  }

  return out;
}