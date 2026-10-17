import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { FieldConfig } from "@/lib/validation/mapping";
import { renderCertificate } from "./render";
import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";

const W = 600;
const H = 400;

type TextItem = { str: string; width: number; transform: number[] };
type PdfJs = {
  getDocument(options: unknown): {
    promise: Promise<{
      getPage(n: number): Promise<{
        getTextContent(): Promise<{ items: unknown[] }>;
      }>;
    }>;
  };
};

async function readText(bytes: Uint8Array): Promise<TextItem[]> {
  const specifier = "pdfjs-dist/legacy/build/pdf.mjs";
  const pdfjs = (await import(/* @vite-ignore */ specifier)) as PdfJs;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return (content.items as TextItem[]).filter(
    (i) => typeof i.str === "string" && i.str.trim() !== ""
  );
}

async function makeTemplate(pages = 1): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([W, H]);
  return pdf.save();
}

function field(over: Partial<FieldConfig>): FieldConfig {
  return {
    id: "a",
    label: "Field",
    source: "A",
    x: 0.5,
    y: 0.4,
    fontSize: 30,
    fontFamily: "OpenSans",
    color: "#000000",
    alignment: "left",
    textCase: "none",
    width: null,
    ...over,
  };
}

async function render(fields: FieldConfig[], values: Record<string, string>, pages = 1, pageNumber = 1) {
  return renderCertificate({
    templateBytes: await makeTemplate(pages),
    pageNumber,
    mapping: { version: 1, fields },
    values,
  });
}

describe("renderCertificate", () => {
  it("anchors left, center and right text at the same x", async () => {
    const { bytes } = await render(
      [
        field({ id: "1", source: "A", y: 0.2, alignment: "left" }),
        field({ id: "2", source: "B", y: 0.4, alignment: "center" }),
        field({ id: "3", source: "C", y: 0.6, alignment: "right" }),
      ],
      { A: "Alpha", B: "Bravo", C: "Charlie" }
    );
    const items = await readText(bytes);
    const get = (s: string) => items.find((i) => i.str === s)!;

    expect(Math.abs(get("Alpha").transform[4] - 300)).toBeLessThan(0.6);
    const b = get("Bravo");
    expect(Math.abs(b.transform[4] + b.width / 2 - 300)).toBeLessThan(0.6);
    const c = get("Charlie");
    expect(Math.abs(c.transform[4] + c.width - 300)).toBeLessThan(0.6);
  });

    it("puts the baseline where the editor expects it", async () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), "public", "fonts", "open-sans-latin-400-normal.woff")
    );
    const f = fontkit.create(new Uint8Array(file)) as unknown as {
      ascent: number;
      descent: number;
      unitsPerEm: number;
    };
    const a = f.ascent / f.unitsPerEm;
    const d = Math.abs(f.descent) / f.unitsPerEm;
    const expected = 30 * (0.5 + (a - d) / 2);

    const { bytes } = await render([field({ y: 0.5 })], { A: "Baseline" });
    const [item] = await readText(bytes);
    const fromTop = H - item.transform[5] - 0.5 * H;

    expect(Math.abs(fromTop - expected)).toBeLessThan(0.5);
  });
  
  it("shrinks text to the maximum width", async () => {
    const { bytes } = await render(
      [field({ width: 0.2, alignment: "left" })],
      { A: "A very long participant name" }
    );
    const [item] = await readText(bytes);
    expect(item.width).toBeLessThanOrEqual(0.2 * W + 0.6);
    expect(item.transform[0]).toBeLessThan(30);
  });

  it("applies text case", async () => {
    const { bytes } = await render([field({ textCase: "title" })], { A: "sahil KUMAR" });
    const items = await readText(bytes);
    expect(items.map((i) => i.str).join(" ")).toContain("Sahil Kumar");
  });

  it("skips empty values and reports a warning", async () => {
    const { bytes, warnings } = await render([field({ label: "Course" })], { A: "   " });
    expect(await readText(bytes)).toHaveLength(0);
    expect(warnings).toEqual(['"Course" is empty.']);
  });

  it("outputs only the selected page", async () => {
    const { bytes } = await render([field({})], { A: "Page two" }, 3, 2);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});