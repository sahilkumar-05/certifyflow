import {
  fieldMappingSchema,
  type FieldMapping,
} from "@/lib/validation/mapping";

export const EMPTY_MAPPING: FieldMapping = { version: 1, fields: [] };

// Safely reads a mapping stored in the database. Bad data becomes an empty mapping.
export function parseStoredMapping(json: unknown): FieldMapping {
  const parsed = fieldMappingSchema.safeParse(json);
  return parsed.success ? parsed.data : EMPTY_MAPPING;
}