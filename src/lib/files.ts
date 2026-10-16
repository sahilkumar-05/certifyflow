// Strips directory parts and control characters from a client-provided name.
export function cleanFileName(name: string, fallback = "file"): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 150);
  return cleaned || fallback;
}