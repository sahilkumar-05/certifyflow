import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { createSmtpTransport, describeSmtpError, type SmtpSettings } from "@/lib/email/transport";
import type { SmtpInput } from "@/lib/validation/smtp";
import type { SmtpPublic } from "@/types/smtp";

// Errors of this type have messages that are safe to show to the user.
export class SmtpValidationError extends Error {}

// Safe to send to the browser: contains no password.
export async function getSmtpPublic(userId: string): Promise<SmtpPublic | null> {
  const row = await prisma.sMTPConfig.findUnique({
    where: { userId },
    select: {
      smtpHost: true,
      smtpPort: true,
      secure: true,
      smtpUsername: true,
      senderName: true,
    },
  });
  if (!row) return null;

  return {
    host: row.smtpHost,
    port: row.smtpPort,
    secure: row.secure,
    username: row.smtpUsername,
    senderName: row.senderName,
  };
}

// Uses the typed password, or the saved one if the host and username did not change.
async function resolvePassword(userId: string, input: SmtpInput): Promise<string> {
  if (input.smtpPassword) return input.smtpPassword;

  const saved = await prisma.sMTPConfig.findUnique({
    where: { userId },
    select: { smtpHost: true, smtpUsername: true, encryptedPassword: true },
  });
  if (!saved) throw new SmtpValidationError("Enter the SMTP password.");

  if (saved.smtpHost !== input.smtpHost || saved.smtpUsername !== input.smtpUsername) {
    throw new SmtpValidationError(
      "Enter the password again when you change the host or username."
    );
  }

  try {
    return decryptSecret(saved.encryptedPassword);
  } catch {
    throw new SmtpValidationError(
      "The saved password could not be read. Please enter it again."
    );
  }
}

export async function saveSmtp(userId: string, input: SmtpInput): Promise<void> {
  const password = await resolvePassword(userId, input);

  const fields = {
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    secure: input.secure,
    smtpUsername: input.smtpUsername,
    senderName: input.senderName,
  };

  await prisma.sMTPConfig.upsert({
    where: { userId },
    create: { userId, ...fields, encryptedPassword: encryptSecret(password) },
    update: {
      ...fields,
      // The stored value is only replaced when a new password was typed.
      ...(input.smtpPassword
        ? { encryptedPassword: encryptSecret(input.smtpPassword) }
        : {}),
    },
  });
}

export async function deleteSmtp(userId: string): Promise<void> {
  await prisma.sMTPConfig.deleteMany({ where: { userId } });
}

// Tests the values from the form without saving anything.
export async function testSmtpConnection(userId: string, input: SmtpInput): Promise<void> {
  const password = await resolvePassword(userId, input);

  try {
    const transporter = await createSmtpTransport({
      host: input.smtpHost,
      port: input.smtpPort,
      secure: input.secure,
      username: input.smtpUsername,
      password,
    });
    try {
      await transporter.verify();
    } finally {
      transporter.close();
    }
  } catch (err) {
    throw new SmtpValidationError(describeSmtpError(err));
  }
}

// Decrypts the saved settings for sending. Returns null if nothing is saved.
export async function loadSavedSmtp(
  userId: string
): Promise<{ settings: SmtpSettings; senderName: string } | null> {
  const row = await prisma.sMTPConfig.findUnique({ where: { userId } });
  if (!row) return null;

  let password: string;
  try {
    password = decryptSecret(row.encryptedPassword);
  } catch {
    throw new SmtpValidationError(
      "The saved SMTP password could not be read. Open the SMTP settings and enter it again."
    );
  }

  return {
    settings: {
      host: row.smtpHost,
      port: row.smtpPort,
      secure: row.secure,
      username: row.smtpUsername,
      password,
    },
    senderName: row.senderName,
  };
}