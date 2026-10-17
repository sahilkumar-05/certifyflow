// Placeholders look like {{Name}}. Matching ignores case and extra spaces.
export const RESERVED_PLACEHOLDERS = ["EventName", "ProjectName"] as const;

const PLACEHOLDER = /\{\{\s*([^{}]{1,100}?)\s*\}\}/g;

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function key(name: string): string {
  return cleanName(name).toLowerCase();
}

export type RenderedText = {
  text: string;
  // Placeholders that were replaced with an empty value.
  empty: string[];
  // Placeholders that do not exist (left as written in the text).
  unknown: string[];
};

// Values of one participant row plus the project values.
export function buildVariables(
  values: Record<string, string>,
  project: { eventName: string; projectName: string }
): Map<string, string> {
  const vars = new Map<string, string>();
  for (const [column, value] of Object.entries(values)) {
    const k = key(column);
    if (!vars.has(k)) vars.set(k, value ?? "");
  }
  // Project values win if a spreadsheet column has the same name.
  vars.set(key("EventName"), project.eventName);
  vars.set(key("ProjectName"), project.projectName);
  return vars;
}

export function renderTemplate(text: string, vars: Map<string, string>): RenderedText {
  const empty = new Set<string>();
  const unknown = new Set<string>();

  const out = text.replace(PLACEHOLDER, (match, raw: string) => {
    const name = cleanName(raw);
    if (!name) return match;

    const value = vars.get(key(name));
    if (value === undefined) {
      unknown.add(name);
      return match;
    }
    if (value.trim() === "") empty.add(name);
    return value;
  });

  return { text: out, empty: [...empty], unknown: [...unknown] };
}

// A subject must be a single line, so line breaks are removed.
export function renderSubject(text: string, vars: Map<string, string>): RenderedText {
  const result = renderTemplate(text, vars);
  return {
    ...result,
    text: result.text.replace(/[\r\n\u2028\u2029]+/g, " ").trim(),
  };
}

export function extractPlaceholders(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER)) {
    const name = cleanName(m[1]);
    if (name) names.add(name);
  }
  return [...names];
}

export function findUnknownPlaceholders(text: string, available: string[]): string[] {
  const known = new Set(available.map(key));
  return extractPlaceholders(text).filter((name) => !known.has(key(name)));
}