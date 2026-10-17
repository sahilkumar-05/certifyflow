import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseStoredMapping } from "@/lib/mapping/parse";
import type { FieldMapping } from "@/lib/validation/mapping";
import type { MappingContextResult } from "@/types/mapping";
import { getSheetInfo } from "@/services/participant.service";

// Errors of this type have messages that are safe to show to the user.
export class MappingValidationError extends Error {}

export function toStringRecord(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, v == null ? "" : String(v)])
  );
}

// Returns null if the project is not owned by the user.
export async function getMappingContext(
  userId: string,
  projectId: string
): Promise<MappingContextResult | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      template: {
        select: {
          pageNumber: true,
          pageWidth: true,
          pageHeight: true,
          fieldMapping: true,
        },
      },
    },
  });
  if (!project) return null;
  if (!project.template) return { ok: false, reason: "template" };

  const rows = await prisma.participant.findMany({
    where: { projectId, validationStatus: "VALID" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rowData: true },
  });
  if (rows.length === 0) return { ok: false, reason: "participants" };

  const participants = rows.map((r) => ({
    id: r.id,
    name: r.name,
    values: toStringRecord(r.rowData),
  }));

  // Headers from the spreadsheet keep the original column order.
  const info = await getSheetInfo(userId, projectId);
  const columns =
    info?.headers.length ? info.headers : Object.keys(participants[0].values);

  // Fields whose column no longer exists are dropped.
  const stored = parseStoredMapping(project.template.fieldMapping);
  const mapping: FieldMapping = {
    version: 1,
    fields: stored.fields.filter((f) => columns.includes(f.source)),
  };

  return {
    ok: true,
    data: {
      page: {
        width: project.template.pageWidth,
        height: project.template.pageHeight,
        pageNumber: project.template.pageNumber,
      },
      columns,
      participants,
      mapping,
    },
  };
}

// Returns null if there is no template owned by the user.
export async function saveMapping(
  userId: string,
  projectId: string,
  mapping: FieldMapping
) {
  const template = await prisma.template.findFirst({
    where: { projectId, project: { userId } },
    select: { id: true },
  });
  if (!template) return null;

  // Never trust the client: every field must use a real spreadsheet column.
  const first = await prisma.participant.findFirst({
    where: { projectId },
    select: { rowData: true },
  });
  const columns = new Set(first ? Object.keys(toStringRecord(first.rowData)) : []);

  for (const field of mapping.fields) {
    if (!columns.has(field.source)) {
      throw new MappingValidationError(
        `Column "${field.source}" does not exist in the spreadsheet.`
      );
    }
  }

  await prisma.template.update({
    where: { id: template.id },
    data: { fieldMapping: mapping as unknown as Prisma.InputJsonObject },
  });
  return true;
}