import { PDFDocument } from "pdf-lib";

// Errors of this type have messages that are safe to show to the user.
export class PdfValidationError extends Error {}

export async function loadPdfForInspection(bytes: Uint8Array): Promise<PDFDocument> {
  const header = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (header !== "%PDF-") {
    throw new PdfValidationError("This file is not a valid PDF.");
  }

  try {
    // Throws for encrypted PDFs because ignoreEncryption is not set.
    return await PDFDocument.load(bytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/encrypted/i.test(message)) {
      throw new PdfValidationError(
        "This PDF is password-protected or encrypted. Remove the protection and upload it again."
      );
    }
    throw new PdfValidationError(
      "This PDF could not be read. It may be corrupted or unsupported."
    );
  }
}

// Returns the visible page size in PDF points, accounting for page rotation.
export function getPageSize(doc: PDFDocument, pageNumber: number) {
  const count = doc.getPageCount();
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > count) {
    throw new PdfValidationError(`Page must be between 1 and ${count}.`);
  }

  const page = doc.getPage(pageNumber - 1);
  const { width, height } = page.getSize();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const swap = rotation === 90 || rotation === 270;

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    width: round(swap ? height : width),
    height: round(swap ? width : height),
  };
}