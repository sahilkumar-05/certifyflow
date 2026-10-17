import { z } from "zod";

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 5000;

export const emailContentSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Enter an email subject")
    .max(MAX_SUBJECT_LENGTH, `The subject must be ${MAX_SUBJECT_LENGTH} characters or less`)
    .refine((s) => !/[\r\n]/.test(s), "The subject must be a single line"),
  body: z
    .string()
    .trim()
    .min(1, "Enter the email body")
    .max(MAX_BODY_LENGTH, `The body must be ${MAX_BODY_LENGTH} characters or less`),
});

export const testEmailSchema = emailContentSchema.extend({
  participantId: z.string().min(1).max(64),
  to: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export type EmailContentInput = z.infer<typeof emailContentSchema>;
export type TestEmailInput = z.infer<typeof testEmailSchema>;