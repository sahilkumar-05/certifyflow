import { z } from "zod";

const column = z.string().trim().min(1, "Select a column").max(100);

export const mappingSchema = z.object({
  sheetName: z.string().max(200).optional(),
  nameColumn: column,
  emailColumn: column,
  referenceColumn: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

export type MappingInput = z.infer<typeof mappingSchema>;