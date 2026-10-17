import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { parseStoredMapping } from "@/lib/mapping/parse";
import { PdfValidationError } from "@/lib/pdf/inspect";
import { renderCertificate } from "@/lib/pdf/render";
import {
  MappingValidationError,
  toStringRecord,
} from "@/services/mapping.service";
import type { BatchResult, GenerationProgress } from "@/types/review";

// Errors of this type have messages that are safe to show to the user.
export class CertificateError extends Error {}

// Certificates handled per request. Small, so a request stays well inside
// serverless time limits.
export const GENERATE_BATCH_SIZE = 5;

export const certificateKey = (projectId: string, participantId: string) =>
  `projects/${projectId}/certificates/${participantId}.pdf`;

// Builds one certificate from the SAVED mapping, exactly like bulk generation.
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

// Valid participants without a certificate, or whose certificate is waiting to be retried.
function pendingWhere(projectId: string): Prisma.ParticipantWhereInput {
  return {
    projectId,
    validationStatus: "VALID",
    OR: [
      { certificate: { is: null } },
      { certificate: { is: { generationStatus: "PENDING" } } },
    ],
  };
}

// The caller must already have checked project ownership.
export async function getGenerationProgress(
  projectId: string
): Promise<GenerationProgress> {
  const [total, generated, failed, remaining] = await Promise.all([
    prisma.participant.count({ where: { projectId, validationStatus: "VALID" } }),
    prisma.certificate.count({
      where: {
        projectId,
        generationStatus: "GENERATED",
        participant: { validationStatus: "VALID" },
      },
    }),
    prisma.certificate.count({
      where: {
        projectId,
        generationStatus: "FAILED",
        participant: { validationStatus: "VALID" },
      },
    }),
    prisma.participant.count({ where: pendingWhere(projectId) }),
  ]);
  return { total, generated, failed, remaining };
}

// Generates the next batch of certificates. Returns null if not found / not owned.
// With retryFailed, failed certificates are queued again first.
export async function generateBatch(
  userId: string,
  projectId: string,
  retryFailed: boolean
): Promise<BatchResult | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      referenceColumn: true,
      template: {
        select: { filePath: true, pageNumber: true, fieldMapping: true },
      },
    },
  });
  if (!project) return null;

  if (!project.template) {
    throw new MappingValidationError("Upload a certificate template first.");
  }
  const mapping = parseStoredMapping(project.template.fieldMapping);
  if (mapping.fields.length === 0) {
    throw new MappingValidationError("Add and save at least one field first.");
  }

  let templateBytes: Uint8Array;
  try {
    templateBytes = new Uint8Array(await storage.read(project.template.filePath));
  } catch {
    throw new CertificateError(
      "The template file could not be read. Upload the template again."
    );
  }

  if (retryFailed) {
    await prisma.certificate.updateMany({
      where: { projectId, generationStatus: "FAILED" },
      data: { generationStatus: "PENDING", generationError: null },
    });
  }

  const batch = await prisma.participant.findMany({
    where: pendingWhere(projectId),
    orderBy: { id: "asc" },
    take: GENERATE_BATCH_SIZE,
    select: { id: true, rowData: true },
  });

  for (const p of batch) {
    const values = toStringRecord(p.rowData);
    const reference = project.referenceColumn
      ? (values[project.referenceColumn] ?? "").trim()
      : "";

    try {
      const result = await renderCertificate({
        templateBytes,
        pageNumber: project.template.pageNumber,
        mapping,
        values,
      });

      const key = certificateKey(projectId, p.id);
      await storage.save(key, result.bytes);

      const warnings = result.warnings.length > 0 ? result.warnings.join("\n") : null;
      await prisma.certificate.upsert({
        where: { participantId: p.id },
        create: {
          projectId,
          participantId: p.id,
          filePath: key,
          referenceNumber: reference || null,
          generationStatus: "GENERATED",
          warnings,
        },
        update: {
          filePath: key,
          referenceNumber: reference || null,
          generationStatus: "GENERATED",
          generationError: null,
          warnings,
        },
      });
    } catch (err) {
      // One participant failing must not stop the others.
      const message =
        err instanceof PdfValidationError
          ? err.message
          : "The certificate could not be generated.";
      await prisma.certificate.upsert({
        where: { participantId: p.id },
        create: {
          projectId,
          participantId: p.id,
          referenceNumber: reference || null,
          generationStatus: "FAILED",
          generationError: message,
        },
        update: { generationStatus: "FAILED", generationError: message },
      });
    }
  }

  return { ...(await getGenerationProgress(projectId)), processed: batch.length };
}

// Deletes all certificates of a project so they can be generated again.
// Blocked once any email was sent. Returns null if not found / not owned.
export async function resetCertificates(
  userId: string,
  projectId: string
): Promise<BatchResult | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) return null;

  const sent = await prisma.certificate.count({
    where: { projectId, emailStatus: "SENT" },
  });
  if (sent > 0) {
    throw new CertificateError(
      "Emails were already sent for this project. Duplicate the project to start a new batch."
    );
  }

  await prisma.certificate.deleteMany({ where: { projectId } });
  try {
    await storage.deletePrefix(`projects/${projectId}/certificates`);
  } catch {
    // The rows are gone. Leftover files can be cleaned later.
  }

  return { ...(await getGenerationProgress(projectId)), processed: 0 };
}