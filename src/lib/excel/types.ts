export type SpreadsheetKind = "xlsx" | "csv";

// One non-empty row as plain strings, before headers are applied.
export type RawLine = { rowNumber: number; cells: string[] };

export type ParsedRow = { rowNumber: number; values: Record<string, string> };

export type SheetData = { headers: string[]; rows: ParsedRow[] };

// Errors of this type have messages that are safe to show to the user.
export class SpreadsheetValidationError extends Error {}