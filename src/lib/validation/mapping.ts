import { z } from "zod";
import { FONT_IDS } from "@/lib/fonts";

export const MAX_MAPPING_FIELDS = 30;

export const fieldSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1, "Field name is required").max(60),
  // The spreadsheet column that provides the value.
  source: z.string().min(1).max(100),
  // Normalized position (0 to 1) from the top-left of the page.
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  fontSize: z.number().min(6, "Font size must be at least 6").max(200),
  fontFamily: z.enum(FONT_IDS),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must look like #000000"),
  alignment: z.enum(["left", "center", "right"]),
  textCase: z.enum(["none", "upper", "title"]),
  // Maximum text width as a fraction of the page width. Text shrinks to fit.
  width: z.number().min(0.05).max(1).nullable(),
});

export const fieldMappingSchema = z.object({
  version: z.literal(1),
  fields: z
    .array(fieldSchema)
    .max(MAX_MAPPING_FIELDS)
    .refine(
      (fields) => new Set(fields.map((f) => f.id)).size === fields.length,
      "Field ids must be unique"
    ),
});

export type FieldConfig = z.infer<typeof fieldSchema>;
export type FieldMapping = z.infer<typeof fieldMappingSchema>;