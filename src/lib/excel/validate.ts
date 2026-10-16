import type { ParsedRow } from "./types";

export type ColumnMapping = {
  nameColumn: string;
  emailColumn: string;
  referenceColumn: string | null;
};

export type ValidatedRow = {
  rowNumber: number;
  name: string;
  email: string;
  reference: string;
  errors: string[];
  values: Record<string, string>;
};

const EMAIL_PATTERN = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function validateRows(
  rows: ParsedRow[],
  mapping: ColumnMapping
): ValidatedRow[] {
  const result: ValidatedRow[] = rows.map((row) => {
    const name = (row.values[mapping.nameColumn] ?? "").trim();
    const email = (row.values[mapping.emailColumn] ?? "").trim().toLowerCase();
    const reference = mapping.referenceColumn
      ? (row.values[mapping.referenceColumn] ?? "").trim()
      : "";

    const errors: string[] = [];
    if (!name) errors.push("Missing name");
    else if (name.includes("@")) errors.push("Name looks like an email address");

    if (!email) errors.push("Missing email");
    else if (!isValidEmail(email)) errors.push("Invalid email address");

    return { rowNumber: row.rowNumber, name, email, reference, errors, values: row.values };
  });

  // Checks that need to compare rows with each other.
  const seenEmails = new Map<string, number>();
  const seenRefs = new Map<string, number>();

  for (const r of result) {
    if (r.email && isValidEmail(r.email)) {
      const first = seenEmails.get(r.email);
      if (first === undefined) seenEmails.set(r.email, r.rowNumber);
      else r.errors.push(`Duplicate email (same as row ${first})`);
    }

    if (mapping.referenceColumn) {
      if (!r.reference) {
        r.errors.push("Missing reference number");
      } else {
        const key = r.reference.toLowerCase();
        const first = seenRefs.get(key);
        if (first === undefined) seenRefs.set(key, r.rowNumber);
        else r.errors.push(`Duplicate reference (same as row ${first})`);
      }
    }
  }

  return result;
}