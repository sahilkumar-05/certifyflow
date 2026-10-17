import { PDFDocument, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getFont, type FontId } from "@/lib/fonts";
import { normalizeRotation, textPlacement, visibleToRaw } from "@/lib/mapping/coordinates";
import { applyTextCase, fitFontSize } from "@/lib/mapping/text";
import type { FieldConfig, FieldMapping } from "@/lib/validation/mapping";
import { embedFonts } from "./font-loader";
import { getPageSize, loadPdfForInspection } from "./inspect";

export type RenderInput = {
  templateBytes: Uint8Array;
  pageNumber: number;
  mapping: FieldMapping;
  // Values of one participant row, keyed by spreadsheet column.
  values: Record<string, string>;
};

export type RenderResult = {
  bytes: Uint8Array;
  // Problems that did not stop the certificate (empty values, unsupported characters).
  warnings: string[];
};

// Built at runtime so it works with any TypeScript target.
const BLANKS = new RegExp("[\\p{Cc}\\s]+", "gu");

// Same cleanup the browser does with white-space: nowrap.
function cleanText(value: string): string {
  return value.replace(BLANKS, " ").trim();
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function renderCertificate(input: RenderInput): Promise<RenderResult> {
  const source = await loadPdfForInspection(input.templateBytes);
  const visible = getPageSize(source, input.pageNumber);

  const sourcePage = source.getPage(input.pageNumber - 1);
  const raw = sourcePage.getSize();
  const box = sourcePage.getMediaBox();
  const rotation = normalizeRotation(sourcePage.getRotation().angle);

  // The output contains only the selected page of the template.
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [page] = await doc.copyPages(source, [input.pageNumber - 1]);
  doc.addPage(page);

  const warnings: string[] = [];
  const jobs: { field: FieldConfig; text: string }[] = [];

  for (const field of input.mapping.fields) {
    const value = cleanText(input.values[field.source] ?? "");
    if (!value) {
      warnings.push(`"${field.label}" is empty.`);
      continue;
    }
    jobs.push({ field, text: applyTextCase(value, field.textCase) });
  }

  const fontIds = [...new Set(jobs.map((j) => j.field.fontFamily))] as FontId[];
  const fonts = await embedFonts(doc, fontIds);

  for (const { field, text } of jobs) {
    const font = fonts.get(field.fontFamily);
    if (!font) continue;

    // Same fitting rule as the editor: shrink the font so the text fits the max width.
    const naturalWidth = font.pdfFont.widthOfTextAtSize(text, field.fontSize);
    const maxWidth = field.width === null ? null : field.width * visible.width;
    const size = fitFontSize(field.fontSize, naturalWidth, maxWidth);
    const width = (naturalWidth * size) / field.fontSize;

    const onVisiblePage = textPlacement(visible, {
      nx: field.x,
      ny: field.y,
      alignment: field.alignment,
      textWidth: width,
      fontSize: size,
      ascent: font.ascent,
      descent: font.descent,
    });
    const placed = visibleToRaw(onVisiblePage, raw, rotation);

    page.drawText(text, {
      x: box.x + placed.x,
      y: box.y + placed.y,
      size,
      font: font.pdfFont,
      color: hexToRgb(field.color),
      rotate: degrees(placed.angle),
    });

    for (const ch of text) {
      if (!font.supports(ch.codePointAt(0) ?? 0)) {
        warnings.push(
          `"${field.label}" contains characters the ${getFont(field.fontFamily).label} font does not support.`
        );
        break;
      }
    }
  }

  return { bytes: await doc.save(), warnings };
}