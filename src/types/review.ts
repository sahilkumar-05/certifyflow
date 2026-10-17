import type { SmtpPublic } from "@/types/smtp";

export type GenerationProgress = {
  // Valid participants in the project.
  total: number;
  generated: number;
  failed: number;
  // Valid participants that still need a certificate.
  remaining: number;
};

export type BatchResult = GenerationProgress & {
  // How many participants this request handled.
  processed: number;
};

export type ReviewContext = {
  projectName: string;
  eventName: string;
  templateName: string | null;
  spreadsheetName: string | null;
  counts: { valid: number; invalid: number };
  fields: { label: string; source: string }[];
  // Labels of fields whose column is not in the current spreadsheet.
  staleFields: string[];
  smtp: SmtpPublic | null;
  emailSubject: string | null;
  emailSaved: boolean;
  participants: { id: string; name: string }[];
  progress: GenerationProgress;
  hasSentEmails: boolean;
};