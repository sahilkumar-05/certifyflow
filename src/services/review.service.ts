import { prisma } from "@/lib/prisma";
import { parseStoredMapping } from "@/lib/mapping/parse";
import { getGenerationProgress } from "@/services/certificate.service";
import { toStringRecord } from "@/services/mapping.service";
import { getSmtpPublic } from "@/services/smtp.service";
import type { ReviewContext } from "@/types/review";

// Returns null if the project is not owned by the user.
export async function getReviewContext(
  userId: string,
  projectId: string
): Promise<ReviewContext | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      name: true,
      eventName: true,
      spreadsheetName: true,
      emailSubject: true,
      emailBody: true,
      template: { select: { originalFileName: true, fieldMapping: true } },
    },
  });
  if (!project) return null;

  const [participants, invalid, first, smtp, progress, sent] = await Promise.all([
    prisma.participant.findMany({
      where: { projectId, validationStatus: "VALID" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.participant.count({ where: { projectId, validationStatus: "INVALID" } }),
    prisma.participant.findFirst({
      where: { projectId, validationStatus: "VALID" },
      select: { rowData: true },
    }),
    getSmtpPublic(userId),
    getGenerationProgress(projectId),
    prisma.certificate.count({ where: { projectId, emailStatus: "SENT" } }),
  ]);

  const columns = new Set(first ? Object.keys(toStringRecord(first.rowData)) : []);
  const mapping = parseStoredMapping(project.template?.fieldMapping);

  return {
    projectName: project.name,
    eventName: project.eventName,
    templateName: project.template?.originalFileName ?? null,
    spreadsheetName: project.spreadsheetName,
    counts: { valid: participants.length, invalid },
    fields: mapping.fields
      .filter((f) => columns.has(f.source))
      .map((f) => ({ label: f.label, source: f.source })),
    staleFields: mapping.fields
      .filter((f) => !columns.has(f.source))
      .map((f) => f.label),
    smtp,
    emailSubject: project.emailSubject,
    emailSaved: !!(project.emailSubject && project.emailBody),
    participants,
    progress,
    hasSentEmails: sent > 0,
  };
}