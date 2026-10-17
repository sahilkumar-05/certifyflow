import type { EmailProgress, GenerationProgress } from "@/types/review";

export type ResultRow = {
  participantId: string;
  name: string;
  email: string;
  certificateId: string | null;
  reference: string;
  // NONE means no certificate record exists yet.
  generation: "NONE" | "PENDING" | "GENERATED" | "FAILED";
  emailStatus: "PENDING" | "SENT" | "FAILED";
  emailError: string | null;
  generationError: string | null;
  warnings: string[];
};

export type ResultsData = {
  projectName: string;
  eventName: string;
  invalidCount: number;
  generation: GenerationProgress;
  email: EmailProgress;
  smtpLabel: string | null;
  emailSubject: string | null;
  emailSaved: boolean;
  rows: ResultRow[];
  page: number;
  pageCount: number;
  filter: "all" | "failed";
  // Rows that match the current filter.
  matching: number;
};