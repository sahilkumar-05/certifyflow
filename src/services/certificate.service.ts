import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { parseStoredMapping } from "@/lib/mapping/parse";
import { renderCertificate } from "@/lib/pdf/render";
import {
  MappingValidationError,
  toStringRecord,
} from "@/services/mapping.service";

// Builds one certificate from the SAVED mapping, exactly like bulk generation will.
// Returns null if the project, template or participant is not found / not owned.
export async function generateSampleCertificate(
  userId: string,
  projectId: string,
  participantId: string
) {
  const participant = await prisma.participant.findFirst({
    where: {
      id: participantId,
      projectId,
      validationStatus: "VALID",
      project: { userId },
    },
    select: { rowData: true },
  });
  if (!participant) return null;

  const template = await prisma.template.findFirst({
    where: { projectId, project: { userId } },
    select: { filePath: true, pageNumber: true, fieldMapping: true },
  });
  if (!template) return null;

  const mapping = parseStoredMapping(template.fieldMapping);
  if (mapping.fields.length === 0) {
    throw new MappingValidationError("Add and save at least one field first.");
  }

  const templateBytes = new Uint8Array(await storage.read(template.filePath));

  return renderCertificate({
    templateBytes,
    pageNumber: template.pageNumber,
    mapping,
    values: toStringRecord(participant.rowData),
  });
}