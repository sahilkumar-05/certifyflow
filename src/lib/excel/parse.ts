import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import {
  MAX_SPREADSHEET_COLUMNS,
  MAX_SPREADSHEET_ROWS,
} from "@/lib/constants";
import {
  SpreadsheetValidationError,
  type RawLine,
  type SheetData,
  type SpreadsheetKind,
} from "./types";

export type OpenedSpreadsheet = {
  // Empty for CSV files (they have no worksheets).
  sheetNames: string[];
  readSheet(sheetName?: string): SheetData & { sheetName: string };
};

export function kindFromFileName(name: string): SpreadsheetKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".csv")) return "csv";
  return null;
}

function tooManyRows() {
  return new SpreadsheetValidationError(
    `Spreadsheets are limited to ${MAX_SPREADSHEET_ROWS} rows. Split the file into smaller files.`
  );
}

function sanitizeHeader(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 100);
  return name === "__proto__" ? "_proto_" : name;
}

// The first non-empty line is the header row. The rest are data rows.
function buildSheet(lines: RawLine[]): SheetData {
  if (lines.length === 0) return { headers: [], rows: [] };

  const [headerLine, ...dataLines] = lines;
  const seen = new Map<string, number>();
  const columns: { index: number; name: string }[] = [];

  headerLine.cells.forEach((raw, index) => {
    const base = sanitizeHeader(raw);
    if (!base) return;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    columns.push({ index, name: count === 1 ? base : `${base} (${count})` });
  });

  if (columns.length > MAX_SPREADSHEET_COLUMNS) {
    throw new SpreadsheetValidationError(
      `Spreadsheets are limited to ${MAX_SPREADSHEET_COLUMNS} columns.`
    );
  }

  const rows = dataLines
    .map((line) => {
      const values: Record<string, string> = {};
      for (const col of columns) values[col.name] = line.cells[col.index] ?? "";
      return { rowNumber: line.rowNumber, values };
    })
    .filter((row) => Object.values(row.values).some((v) => v !== ""));

  return { headers: columns.map((c) => c.name), rows };
}

// ---------- XLSX ----------

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[])
        .map((part) => part.text ?? "")
        .join("")
        .trim();
    }
    if ("result" in v) return cellToString(v.result); // formula cell
    if ("text" in v) return cellToString(v.text); // hyperlink cell
    return "";
  }
  return String(value).trim();
}

function collectXlsxLines(ws: ExcelJS.Worksheet): RawLine[] {
  const lines: RawLine[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const raw: unknown[] = Array.isArray(row.values) ? row.values : [];
    // ExcelJS row values are 1-based, so index 0 is always empty.
    const cells = Array.from({ length: Math.max(raw.length - 1, 0) }, (_, i) =>
      cellToString(raw[i + 1])
    );
    if (cells.every((c) => c === "")) return;

    // header row + MAX data rows is the most we accept
    if (lines.length > MAX_SPREADSHEET_ROWS) throw tooManyRows();
    lines.push({ rowNumber, cells });
  });

  return lines;
}

async function openXlsx(bytes: Uint8Array): Promise<OpenedSpreadsheet> {
  // .xlsx files are ZIP archives and always start with "PK".
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new SpreadsheetValidationError(
      "This file is not a valid .xlsx workbook. Password-protected files are not supported."
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  } catch {
    throw new SpreadsheetValidationError(
      "This Excel file could not be read. It may be corrupted."
    );
  }

  const sheets = workbook.worksheets.filter((ws) => ws.state === "visible");
  if (sheets.length === 0) {
    throw new SpreadsheetValidationError(
      "This workbook has no visible worksheets."
    );
  }

  return {
    sheetNames: sheets.map((ws) => ws.name),
    readSheet(sheetName) {
      const ws = sheetName ? sheets.find((s) => s.name === sheetName) : sheets[0];
      if (!ws) throw new SpreadsheetValidationError("Worksheet not found.");
      return { sheetName: ws.name, ...buildSheet(collectXlsxLines(ws)) };
    },
  };
}

// ---------- CSV ----------

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const counts = [",", ";", "\t"].map((d) => ({
    d,
    n: firstLine.split(d).length - 1,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

function openCsv(bytes: Uint8Array): OpenedSpreadsheet {
  if (bytes.subarray(0, 2048).includes(0)) {
    throw new SpreadsheetValidationError("This file is not a valid CSV file.");
  }
  const text = new TextDecoder("utf-8").decode(bytes);

  return {
    sheetNames: [],
    readSheet() {
      let records: { record: string[]; info: { lines: number } }[];
      try {
        records = parse(text, {
          bom: true,
          delimiter: detectDelimiter(text),
          skip_empty_lines: true,
          relax_column_count: true,
          relax_quotes: true,
          trim: true,
          info: true,
        });
      } catch {
        throw new SpreadsheetValidationError(
          "This CSV file could not be parsed. Check that it is a valid CSV."
        );
      }

      const lines: RawLine[] = [];
      for (const { record, info } of records) {
        if (record.every((c) => c === "")) continue;
        if (lines.length > MAX_SPREADSHEET_ROWS) throw tooManyRows();
        lines.push({ rowNumber: info.lines, cells: record });
      }
      return { sheetName: "", ...buildSheet(lines) };
    },
  };
}

export async function openSpreadsheet(
  bytes: Uint8Array,
  kind: SpreadsheetKind
): Promise<OpenedSpreadsheet> {
  return kind === "xlsx" ? openXlsx(bytes) : openCsv(bytes);
}