import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { asciiSlug, certificateFileName } from "@/lib/files";

// Returns null if the certificate is not found / not owned / has no file.
export async function readCertificateFile(
  userId: string,
  projectId: string,
  certificateId: string
) {
  const cert = await prisma.certificate.findFirst({
    where: {
      id: certificateId,
      projectId,
      generationStatus: "GENERATED",
      project: { userId },
    },
    select: {
      filePath: true,
      referenceNumber: true,
      participant: { select: { name: true } },
    },
  });
  if (!cert?.filePath) return null;

  try {
    const bytes = await storage.read(cert.filePath);
    return {
      bytes,
      fileName: certificateFileName(cert.referenceNumber, cert.participant.name),
    };
  } catch {
    return null;
  }
}

// Everything that goes into the ZIP, with unique file names.
// Returns null if the project is not owned by the user.
export async function listDownloadableCertificates(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { name: true },
  });
  if (!project) return null;

  const rows = await prisma.certificate.findMany({
    where: {
      projectId,
      generationStatus: "GENERATED",
      participant: { validationStatus: "VALID" },
    },
    orderBy: { id: "asc" },
    select: {
      filePath: true,
      referenceNumber: true,
      participant: { select: { name: true } },
    },
  });

  const used = new Set<string>();
  const items: { filePath: string; fileName: string }[] = [];

  for (const row of rows) {
    if (!row.filePath) continue;

    let fileName = certificateFileName(row.referenceNumber, row.participant.name);
    if (used.has(fileName)) {
      const base = fileName.slice(0, -".pdf".length);
      let n = 2;
      while (used.has(`${base}_${n}.pdf`)) n++;
      fileName = `${base}_${n}.pdf`;
    }
    used.add(fileName);
    items.push({ filePath: row.filePath, fileName });
  }

  return {
    zipName: `${asciiSlug(project.name, "project")}_certificates.zip`,
    items,
  };
}