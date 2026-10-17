import { z } from "zod";

export const ALLOWED_SMTP_PORTS = [587, 465, 2525, 25] as const;

export const smtpSchema = z.object({
  smtpHost: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Enter the SMTP host")
    .max(253, "The SMTP host is too long")
    .regex(
      /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/,
      "Enter a valid host name such as smtp.gmail.com"
    ),
  smtpPort: z
    .number()
    .int()
    .refine(
      (p) => (ALLOWED_SMTP_PORTS as readonly number[]).includes(p),
      "Port must be 587, 465, 2525 or 25"
    ),
  secure: z.boolean(),
  smtpUsername: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email("The username must be the email address you send from"),
  // Optional: leaving it empty keeps the saved password.
  smtpPassword: z
    .string()
    .max(200, "The password is too long")
    .optional()
    .transform((v) => (v ? v : undefined)),
  senderName: z
    .string()
    .trim()
    .min(1, "Enter a sender name")
    .max(100, "The sender name is too long")
    .refine((s) => !/[\r\n]/.test(s), "The sender name must be a single line"),
});

export type SmtpInput = z.infer<typeof smtpSchema>;