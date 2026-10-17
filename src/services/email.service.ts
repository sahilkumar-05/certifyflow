import { prisma } from "@/lib/prisma";
import { createSmtpTransport, describeSmtpError } from "@/lib/email/transport";
import { DEFAULT_EMAIL_SUBJECT, defaultEmailBody } from "@/lib/email/defaults";
import {
  RESERVED_PLACEHOLDERS,
  buildVariables,
  findUnknownPlaceholders,
  renderSubject,
  renderTemplate,
} from "@/lib/email/template";
import { PdfValidationError } from "@/lib/pdf/inspect";
import type { EmailContentInput, TestEmailInput } from "@/lib/validation/email";
import type { EmailContextResult } from "@/types/email";
import { generateSampleCertificate } from "@/services/certificate.service";
import { MappingValidationError, toStringRecord } from "@/services/mapping.service";
import { getSheetInfo } from "@/services/participant.service";
import {
  SmtpValidationError,
  getSmtpPublic,
  loadSavedSmtp,
} from "@/services/smtp.service";

// Errors of this type have messages that are safe to show to the user.
export class EmailValidationError extends Error {}

async function firstRowColumns(projectId: string): Promise<string[]> {
  const first = await prisma.participant.findFirst({
    where: { projectId },
    select: { rowData: true },
  });
  if (!first) throw new EmailValidationError("Save the participants first.");
  return Object.keys(toStringRecord(first.rowData));
}

// Every placeholder must exist, so "{{Typo}}" never reaches a real email.
function assertKnownPlaceholders(content: EmailContentInput, columns: string[]) {
  const allowed = [...columns, ...RESERVED_PLACEHOLDERS];
  const unknown = [
    ...new Set([
      ...findUnknownPlaceholders(content.subject, allowed),
      ...findUnknownPlaceholders(content.body, allowed),
    ]),
  ];
  if (unknown.length > 0) {
    throw new EmailValidationError(
      `Unknown placeholders: ${unknown.map((n) => `{{${n}}}`).join(", ")}. Use the placeholder list to insert valid ones.`
    );
  }
}

// Returns null if the project is not owned by the user.
export async function getEmailContext(
  userId: string,
  projectId: string
): Promise<EmailContextResult | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      name: true,
      eventName: true,
      emailSubject: true,
      emailBody: true,
      nameColumn: true,
    },
  });
  if (!project) return null;

  const rows = await prisma.participant.findMany({
    where: { projectId, validationStatus: "VALID" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, rowData: true },
  });
  if (rows.length === 0) return { ok: false, reason: "participants" };

  const participants = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    values: toStringRecord(r.rowData),
  }));

  // Spreadsheet headers keep the original column order.
  let columns: string[] = [];
  try {
    columns = (await getSheetInfo(userId, projectId))?.headers ?? [];
  } catch {
    columns = [];
  }
  if (columns.length === 0) columns = Object.keys(participants[0].values);

  return {
    ok: true,
    data: {
      projectName: project.name,
      eventName: project.eventName,
      subject: project.emailSubject ?? DEFAULT_EMAIL_SUBJECT,
      body: project.emailBody ?? defaultEmailBody(project.nameColumn),
      saved: !!(project.emailSubject && project.emailBody),
      columns,
      participants,
      smtp: await getSmtpPublic(userId),
    },
  };
}

// Returns null if the project is not owned by the user.
export async function saveEmailContent(
  userId: string,
  projectId: string,
  content: EmailContentInput
): Promise<true | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) return null;

  assertKnownPlaceholders(content, await firstRowColumns(projectId));

  await prisma.project.update({
    where: { id: projectId },
    data: { emailSubject: content.subject, emailBody: content.body },
  });
  return true;
}

// Sends one test email using the SAVED SMTP settings and the subject and body from the editor.
// Returns null if the project or participant is not found / not owned.
export async function sendTestEmail(
  userId: string,
  projectId: string,
  input: TestEmailInput
): Promise<{ attachment: boolean; warnings: string[] } | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { name: true, eventName: true },
  });
  if (!project) return null;

  const participant = await prisma.participant.findFirst({
    where: { id: input.participantId, projectId, validationStatus: "VALID" },
    select: { rowData: true },
  });
  if (!participant) return null;

  const values = toStringRecord(participant.rowData);
  assertKnownPlaceholders(input, Object.keys(values));

  const smtp = await loadSavedSmtp(userId);
  if (!smtp) throw new SmtpValidationError("Save your SMTP settings first.");

  const vars = buildVariables(values, {
    eventName: project.eventName,
    projectName: project.name,
  });
  const subject = renderSubject(input.subject, vars);
  const body = renderTemplate(input.body, vars);

  const warnings: string[] = [];
  const emptyValues = [...new Set([...subject.empty, ...body.empty])];
  if (emptyValues.length > 0) {
    warnings.push(
      `These placeholders are empty for this participant: ${emptyValues.join(", ")}.`
    );
  }

  // Attach a sample certificate when the saved field mapping allows it.
  let attachment: Buffer | null = null;
  try {
    const sample = await generateSampleCertificate(userId, projectId, input.participantId);
    if (sample) {
      attachment = Buffer.from(sample.bytes);
      warnings.push(...sample.warnings);
    }
  } catch (err) {
    if (err instanceof MappingValidationError || err instanceof PdfValidationError) {
      warnings.push(`No certificate was attached. ${err.message}`);
    } else {
      throw err;
    }
  }

  try {
    const transporter = await createSmtpTransport(smtp.settings);
    try {
      await transporter.sendMail({
        from: { name: smtp.senderName, address: smtp.settings.username },
        to: input.to,
        subject: `[TEST] ${subject.text}`,
        text: body.text,
        attachments: attachment
          ? [
              {
                filename: "sample-certificate.pdf",
                content: attachment,
                contentType: "application/pdf",
              },
            ]
          : [],
      });
    } finally {
      transporter.close();
    }
  } catch (err) {
    throw new SmtpValidationError(describeSmtpError(err));
  }

  return { attachment: attachment !== null, warnings };
}