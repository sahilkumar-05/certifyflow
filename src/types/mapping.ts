import type { FieldMapping } from "@/lib/validation/mapping";

export type EditorParticipant = {
  id: string;
  name: string;
  values: Record<string, string>;
};

export type MappingContext = {
  page: { width: number; height: number; pageNumber: number };
  columns: string[];
  participants: EditorParticipant[];
  mapping: FieldMapping;
};

export type MappingContextResult =
  | { ok: true; data: MappingContext }
  | { ok: false; reason: "template" | "participants" };