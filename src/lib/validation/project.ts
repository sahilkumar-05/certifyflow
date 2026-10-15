import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(100),
  eventName: z.string().trim().min(2, "Event name must be at least 2 characters").max(100),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type ProjectInput = z.infer<typeof projectSchema>;