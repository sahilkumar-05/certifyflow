import { DEFAULT_FONT_ID } from "@/lib/fonts";
import type { FieldConfig } from "@/lib/validation/mapping";

function newId(): string {
  return `f_${Math.random().toString(36).slice(2, 12)}`;
}

// A new field for a spreadsheet column. `index` staggers the start position
// so new fields do not sit exactly on top of each other.
export function createField(source: string, index: number): FieldConfig {
  return {
    id: newId(),
    label: source.slice(0, 60),
    source,
    x: 0.5,
    y: Math.min(0.2 + index * 0.1, 0.9),
    fontSize: 28,
    fontFamily: DEFAULT_FONT_ID,
    color: "#000000",
    alignment: "center",
    textCase: "none",
    width: null,
  };
}