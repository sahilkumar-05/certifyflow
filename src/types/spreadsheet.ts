export type SheetInfo = {
  fileName: string;
  // Empty for CSV files.
  sheetNames: string[];
  sheetName: string;
  headers: string[];
  totalRows: number;
  previewRows: Record<string, string>[];
  // Saved or auto-suggested columns ("" means none).
  mapping: {
    nameColumn: string;
    emailColumn: string;
    referenceColumn: string;
  };
};

export type ValidationSummary = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  // Only the first few invalid rows are returned.
  invalidRows: {
    rowNumber: number;
    name: string;
    email: string;
    errors: string[];
  }[];
};