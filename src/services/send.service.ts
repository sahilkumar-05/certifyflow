import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { createSmtpTransport, describeSmtpError } from "@/lib/email/transport";
import {
  buildVariables,
  renderSubject,
  renderTemplate,
} from "@/lib/email/template";
import { certificateFileName } from "@/lib/files";
import type { EmailProgress, SendBatchResult } from "@/types/review";
import {
  assertKnownPlaceholders,
  firstRowColumns,
} from "@/services/email.service";
import { toStringRecord } from "@/services/mapping.service";
import { SmtpValidationError, loadSavedSmtp } from "@/services/smtp.service";

// Errors of this type have messages that are safe to show to the user.
export class SendError extends Error {}

// Emails handled per request. Small, so a request stays inside serverless time limits.
export const SEND_BATCH_SIZE = 5;

const FALLBACK_SUBJECT = "Your certificate";

// Best effort protection against two sending requests for one project at the same time.
const activeProjects = new Set<string>();

// Certificates that exist and can be emailed.
function sendableWhere(projectId: string): Prisma.CertificateWhereInput {
  return {
    projectId,
    generationStatus: "GENERATED",
    participant: { validationStatus: "VALID" },
  };
}

// The caller must already have checked project ownership.
export async function getEmailProgress(projectId: string): Promise<EmailProgress> {
  const base = sendableWhere(projectId);
  const [total, sent, failed, remaining] = await Promise.all([
    prisma.certificate.count({ where: base }),
    prisma.certificate.count({ where: { ...base, emailStatus: "SENT" } }),
    prisma.certificate.count({ where: { ...base, emailStatus: "FAILED" } }),
    prisma.certificate.count({ where: { ...base, emailStatus: "PENDING" } }),
  ]);
  return { total, sent, failed, remaining };
}

async function markFailed(certificateId: string, message: string) {
  await prisma.certificate.update({
    where: { id: certificateId },
    data: { emailStatus: "FAILED", emailError: message },
  });
}

// Sends the next batch of emails using the SAVED SMTP settings and the saved
// subject and body. Returns null if the project is not found / not owned.
// With retryFailed, failed emails are queued again first. The certificates are
// never generated again.
export async function sendBatch(
  userId: string,
  projectId: string,
  retryFailed: boolean
): Promise<SendBatchResult | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { name: true, eventName: true, emailSubject: true, emailBody: true },
  });
  if (!project) return null;

  if (!project.emailSubject || !project.emailBody) {
    throw new SendError("Save the email subject and body first.");
  }

  const smtp = await loadSavedSmtp(userId);
  if (!smtp) throw new SmtpValidationError("Set up your SMTP settings first.");

  // A typo like {{Nmae}} must never reach a real email.
  assertKnownPlaceholders(
    { subject: project.emailSubject, body: project.emailBody },
    await firstRowColumns(projectId)
  );

  if (activeProjects.has(projectId)) {
    throw new SendError(
      "Another sending request is still running for this project. Wait a moment and try again."
    );
  }
  activeProjects.add(projectId);

  try {
    if (retryFailed) {
      await prisma.certificate.updateMany({
        where: { ...sendableWhere(projectId), emailStatus: "FAILED" },
        data: { emailStatus: "PENDING", emailError: null },
      });
    }

    const batch = await prisma.certificate.findMany({
      where: { ...sendableWhere(projectId), emailStatus: "PENDING" },
      orderBy: { id: "asc" },
      take: SEND_BATCH_SIZE,
      select: {
        id: true,
        filePath: true,
        referenceNumber: true,
        participant: { select: { name: true, email: true, rowData: true } },
      },
    });

    if (batch.length === 0) {
      return { ...(await getEmailProgress(projectId)), processed: 0 };
    }

    await prisma.project.updateMany({
      where: { id: projectId },
      data: { status: "PROCESSING" },
    });

    let transporter: Awaited<ReturnType<typeof createSmtpTransport>>;
    try {
      transporter = await createSmtpTransport(smtp.settings);
    } catch (err) {
      throw new SmtpValidationError(describeSmtpError(err));
    }

    try {
      for (const cert of batch) {
        const values = toStringRecord(cert.participant.rowData);
        const vars = buildVariables(values, {
          eventName: project.eventName,
          projectName: project.name,
        });
        const subject = renderSubject(project.emailSubject, vars);
        const body = renderTemplate(project.emailBody, vars);

        let pdf: Buffer;
        try {
          if (!cert.filePath) throw new Error("No file");
          pdf = await storage.read(cert.filePath);
        } catch {
          await markFailed(cert.id, "The certificate file could not be read.");
          continue;
        }

        try {
          await transporter.sendMail({
            from: { name: smtp.senderName, address: smtp.settings.username },
            to: cert.participant.email,
            subject: subject.text || FALLBACK_SUBJECT,
            text: body.text,
            attachments: [
              {
                filename: certificateFileName(
                  cert.referenceNumber,
                  cert.participant.name
                ),
                content: pdf,
                contentType: "application/pdf",
              },
            ],
          });
        } catch (err) {
          // Login and TLS problems affect every email, so stop instead of marking
          // each participant as failed. Fix the settings, then resume.
          const code = (err as { code?: string } | null)?.code;
          if (code === "EAUTH" || code === "ETLS") {
            throw new SmtpValidationError(describeSmtpError(err));
          }
          await markFailed(cert.id, describeSmtpError(err));
          continue;
        }

        await prisma.certificate.update({
          where: { id: cert.id },
          data: { emailStatus: "SENT", emailError: null },
        });
      }
    } finally {
      transporter.close();
    }

    const progress = await getEmailProgress(projectId);
    if (progress.remaining === 0) {
      await prisma.project.updateMany({
        where: { id: projectId },
        data: { status: "COMPLETED" },
      });
    }
    return { ...progress, processed: batch.length };
  } finally {
    activeProjects.delete(projectId);
  }
}