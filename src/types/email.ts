import type { SmtpPublic } from "@/types/smtp";

export type EmailParticipant = {
  id: string;
  name: string;
  email: string;
  values: Record<string, string>;
};

export type EmailContext = {
  projectName: string;
  eventName: string;
  subject: string;
  body: string;
  // False while the subject and body are still the suggested defaults.
  saved: boolean;
  columns: string[];
  participants: EmailParticipant[];
  smtp: SmtpPublic | null;
};

export type EmailContextResult =
  | { ok: true; data: EmailContext }
  | { ok: false; reason: "participants" };