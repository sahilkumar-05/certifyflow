// Strips directory parts and control characters from a client-provided name.
export function cleanFileName(name: string, fallback = "file"): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 150);
  return cleaned || fallback;
}

// Turns any text into a safe ASCII name for downloads and attachments.
export function asciiSlug(value: string, fallback: string, max = 60): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, max);
  return slug || fallback;
}

// File name of a participant's certificate. Uses the reference number when there is one.
export function certificateFileName(reference: string | null, name: string): string {
  return `certificate_${asciiSlug(reference || name, "participant")}.pdf`;
}