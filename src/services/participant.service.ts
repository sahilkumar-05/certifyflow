import { parseStoredMapping } from "@/lib/mapping/parse";
import { Prisma, type ValidationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import {
  kindFromFileName,
  openSpreadsheet,
  type OpenedSpreadsheet,
} from "@/lib/excel/parse";
import { suggestMapping } from "@/lib/excel/suggest";
import { SpreadsheetValidationError, type SheetData } from "@/lib/excel/types";
import { validateRows, type ValidatedRow } from "@/lib/excel/validate";
import type { MappingInput } from "@/lib/validation/spreadsheet";
import type { SheetInfo, ValidationSummary } from "@/types/spreadsheet";

const PREVIEW_ROWS = 10;
const INVALID_SAMPLE = 25;

const spreadsheetKey = (projectId: string, kind: string) =>
  `projects/${projectId}/spreadsheet.${kind}`;
// Replacing participants would delete their certificates (cascade), so it is blocked.
async function assertNoCertificates(projectId: string) {
  const count = await prisma.certificate.count({ where: { projectId } });
  if (count > 0) {
    throw new SpreadsheetValidationError(
      "This project already has generated certificates. Reset them on the Review step, or duplicate the project to start a new batch."
    );
  }
}
type SavedMapping = {
  nameColumn: string | null;
  emailColumn: string | null;
  referenceColumn: string | null;
};

function buildInfo(
  fileName: string,
  opened: OpenedSpreadsheet,
  sheet: SheetData & { sheetName: string },
  saved?: SavedMapping
): SheetInfo {
  const suggested = suggestMapping(sheet.headers);
  const keep = (value: string | null | undefined, fallback: string) =>
    value && sheet.headers.includes(value) ? value : fallback;

  return {
    fileName,
    sheetNames: opened.sheetNames,
    sheetName: sheet.sheetName,
    headers: sheet.headers,
    totalRows: sheet.rows.length,
    previewRows: sheet.rows.slice(0, PREVIEW_ROWS).map((r) => r.values),
    mapping: {
      nameColumn: keep(saved?.nameColumn, suggested.nameColumn),
      emailColumn: keep(saved?.emailColumn, suggested.emailColumn),
      referenceColumn: keep(saved?.referenceColumn, suggested.referenceColumn),
    },
  };
}

// Returns null if the project is not owned by the user or has no spreadsheet.
async function openProjectSpreadsheet(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      spreadsheetPath: true,
      spreadsheetName: true,
      sheetName: true,
      nameColumn: true,
      emailColumn: true,
      referenceColumn: true,
    },
  });
  if (!project?.spreadsheetPath || !project.spreadsheetName) return null;

  const kind = kindFromFileName(project.spreadsheetPath);
  if (!kind) return null;

  const bytes = new Uint8Array(await storage.read(project.spreadsheetPath));
  const opened = await openSpreadsheet(bytes, kind);
  return { project, fileName: project.spreadsheetName, opened };
}

// Returns null if the project does not belong to the user.
export async function saveSpreadsheet(
  userId: string,
  projectId: string,
  fileName: string,
  bytes: Uint8Array
): Promise<SheetInfo | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      spreadsheetPath: true,
      nameColumn: true,
      emailColumn: true,
      referenceColumn: true,
    },
  });
  if (!project) return null;

  await assertNoCertificates(projectId);

  const kind = kindFromFileName(fileName);
  if (!kind) {
    throw new SpreadsheetValidationError("Only .xlsx and .csv files are accepted.");
  }

  // Validate before anything is stored.
  const opened = await openSpreadsheet(bytes, kind);
  const sheet = opened.readSheet();

  const key = spreadsheetKey(projectId, kind);
  await storage.save(key, bytes);
  if (project.spreadsheetPath && project.spreadsheetPath !== key) {
    await storage.delete(project.spreadsheetPath).catch(() => {});
  }

  // Keep the field mapping for columns that still exist in the new file.
  const template = await prisma.template.findUnique({
    where: { projectId },
    select: { fieldMapping: true },
  });
  const keptFields = parseStoredMapping(template?.fieldMapping).fields.filter((f) =>
    sheet.headers.includes(f.source)
  );
  const keptMapping =
    keptFields.length > 0
      ? ({ version: 1, fields: keptFields } as unknown as Prisma.InputJsonObject)
      : Prisma.DbNull;

  await prisma.$transaction([
    prisma.participant.deleteMany({ where: { projectId } }),
    prisma.template.updateMany({
      where: { projectId },
      data: { fieldMapping: keptMapping },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        spreadsheetPath: key,
        spreadsheetName: fileName,
        sheetName: sheet.sheetName || null,
      },
    }),
  ]);

  // Earlier column choices are suggested again when the new file has the same columns.
  return buildInfo(fileName, opened, sheet, project);
}

// Returns null if there is no spreadsheet owned by the user.
export async function getSheetInfo(
  userId: string,
  projectId: string,
  sheetName?: string
): Promise<SheetInfo | null> {
  const ctx = await openProjectSpreadsheet(userId, projectId);
  if (!ctx) return null;

  const sheet = ctx.opened.readSheet(
    sheetName || ctx.project.sheetName || undefined
  );
  return buildInfo(ctx.fileName, ctx.opened, sheet, ctx.project);
}

async function loadValidated(
  userId: string,
  projectId: string,
  input: MappingInput
) {
  const ctx = await openProjectSpreadsheet(userId, projectId);
  if (!ctx) return null;

  const sheet = ctx.opened.readSheet(
    input.sheetName || ctx.project.sheetName || undefined
  );

  if (input.nameColumn === input.emailColumn) {
    throw new SpreadsheetValidationError(
      "Name and Email must use different columns."
    );
  }
  for (const col of [input.nameColumn, input.emailColumn, input.referenceColumn]) {
    if (col && !sheet.headers.includes(col)) {
      throw new SpreadsheetValidationError(
        `Column "${col}" was not found in this worksheet.`
      );
    }
  }

  return { sheet, validated: validateRows(sheet.rows, input) };
}

function summarize(validated: ValidatedRow[]): ValidationSummary {
  const invalid = validated.filter((v) => v.errors.length > 0);
  return {
    totalRows: validated.length,
    validCount: validated.length - invalid.length,
    invalidCount: invalid.length,
    invalidRows: invalid.slice(0, INVALID_SAMPLE).map((v) => ({
      rowNumber: v.rowNumber,
      name: v.name,
      email: v.email,
      errors: v.errors,
    })),
  };
}

// Dry run: nothing is written. Returns null if not found / not owned.
export async function validateMapping(
  userId: string,
  projectId: string,
  input: MappingInput
): Promise<ValidationSummary | null> {
  const loaded = await loadValidated(userId, projectId, input);
  if (!loaded) return null;
  return summarize(loaded.validated);
}

// Replaces the project's participants. Returns null if not found / not owned.
export async function saveParticipants(
  userId: string,
  projectId: string,
  input: MappingInput
): Promise<ValidationSummary | null> {
  const loaded = await loadValidated(userId, projectId, input);
  if (!loaded) return null;
  await assertNoCertificates(projectId);
  const summary = summarize(loaded.validated);
  if (summary.validCount === 0) {
    throw new SpreadsheetValidationError(
      "No valid records found. Fix the spreadsheet or choose different columns."
    );
  }

  await prisma.$transaction([
    prisma.participant.deleteMany({ where: { projectId } }),
    prisma.participant.createMany({
      data: loaded.validated.map((v) => ({
        projectId,
        name: v.name,
        email: v.email,
        rowData: v.values as Prisma.InputJsonObject,
        validationStatus: (v.errors.length > 0
          ? "INVALID"
          : "VALID") as ValidationStatus,
      })),
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        sheetName: loaded.sheet.sheetName || null,
        nameColumn: input.nameColumn,
        emailColumn: input.emailColumn,
        referenceColumn: input.referenceColumn,
      },
    }),
  ]);

  return summary;
}

// The caller must already have checked project ownership.
export async function getParticipantCounts(projectId: string) {
  const [valid, invalid] = await Promise.all([
    prisma.participant.count({ where: { projectId, validationStatus: "VALID" } }),
    prisma.participant.count({ where: { projectId, validationStatus: "INVALID" } }),
  ]);
  return { valid, invalid };
}