import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGenerationProgress } from "@/services/certificate.service";
import { getEmailProgress } from "@/services/send.service";
import { getSmtpPublic } from "@/services/smtp.service";
import type { ResultRow, ResultsData } from "@/types/results";

export const RESULTS_PAGE_SIZE = 25;

export type ResultsFilter = "all" | "failed";

// Returns null if the project is not owned by the user.
export async function getResults(
  userId: string,
  projectId: string,
  requestedPage: number,
  filter: ResultsFilter
): Promise<ResultsData | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { name: true, eventName: true, emailSubject: true, emailBody: true },
  });
  if (!project) return null;

  const where: Prisma.ParticipantWhereInput = {
    projectId,
    validationStatus: "VALID",
    ...(filter === "failed"
      ? {
          certificate: {
            is: {
              OR: [{ generationStatus: "FAILED" }, { emailStatus: "FAILED" }],
            },
          },
        }
      : {}),
  };

  const [matching, invalidCount, generation, email, smtp] = await Promise.all([
    prisma.participant.count({ where }),
    prisma.participant.count({ where: { projectId, validationStatus: "INVALID" } }),
    getGenerationProgress(projectId),
    getEmailProgress(projectId),
    getSmtpPublic(userId),
  ]);

  const pageCount = Math.max(1, Math.ceil(matching / RESULTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);

  const participants = await prisma.participant.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * RESULTS_PAGE_SIZE,
    take: RESULTS_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      certificate: {
        select: {
          id: true,
          referenceNumber: true,
          generationStatus: true,
          emailStatus: true,
          emailError: true,
          generationError: true,
          warnings: true,
        },
      },
    },
  });

  const rows: ResultRow[] = participants.map((p) => {
    const c = p.certificate;
    return {
      participantId: p.id,
      name: p.name,
      email: p.email,
      certificateId: c?.id ?? null,
      reference: c?.referenceNumber ?? "",
      generation: c?.generationStatus ?? "NONE",
      emailStatus: c?.emailStatus ?? "PENDING",
      emailError: c?.emailError ?? null,
      generationError: c?.generationError ?? null,
      warnings: c?.warnings ? c.warnings.split("\n").filter(Boolean) : [],
    };
  });

  return {
    projectName: project.name,
    eventName: project.eventName,
    invalidCount,
    generation,
    email,
    smtpLabel: smtp ? `${smtp.senderName} <${smtp.username}>` : null,
    emailSubject: project.emailSubject,
    emailSaved: !!(project.emailSubject && project.emailBody),
    rows,
    page,
    pageCount,
    filter,
    matching,
  };
}