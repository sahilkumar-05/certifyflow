import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import {
  getPageSize,
  loadPdfForInspection,
} from "@/lib/pdf/inspect";

export const templateKey = (projectId: string) =>
  `projects/${projectId}/template.pdf`;

// Returns null if the project does not belong to the user.
export async function saveTemplate(
  userId: string,
  projectId: string,
  fileName: string,
  bytes: Uint8Array
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) return null;

  // Validate before anything is stored.
  const doc = await loadPdfForInspection(bytes);
  const pageCount = doc.getPageCount();
  const size = getPageSize(doc, 1);

  const key = templateKey(projectId);
  await storage.save(key, bytes);

  // A new template invalidates any old field mapping.
  const template = await prisma.template.upsert({
    where: { projectId },
    create: {
      projectId,
      filePath: key,
      originalFileName: fileName,
      pageNumber: 1,
      pageWidth: size.width,
      pageHeight: size.height,
    },
    update: {
      filePath: key,
      originalFileName: fileName,
      pageNumber: 1,
      pageWidth: size.width,
      pageHeight: size.height,
      fieldMapping: Prisma.DbNull,
    },
    select: {
      originalFileName: true,
      pageNumber: true,
      pageWidth: true,
      pageHeight: true,
    },
  });

  return { ...template, pageCount };
}

// Returns null if there is no template owned by the user.
export async function changeTemplatePage(
  userId: string,
  projectId: string,
  pageNumber: number
) {
  const template = await prisma.template.findFirst({
    where: { projectId, project: { userId } },
    select: { id: true, filePath: true },
  });
  if (!template) return null;

  const bytes = await storage.read(template.filePath);
  const doc = await loadPdfForInspection(new Uint8Array(bytes));
  const size = getPageSize(doc, pageNumber);

  return prisma.template.update({
    where: { id: template.id },
    data: { pageNumber, pageWidth: size.width, pageHeight: size.height },
    select: { pageNumber: true, pageWidth: true, pageHeight: true },
  });
}

// Returns null if there is no template owned by the user.
export async function readTemplateFile(userId: string, projectId: string) {
  const template = await prisma.template.findFirst({
    where: { projectId, project: { userId } },
    select: { filePath: true },
  });
  if (!template) return null;
  return storage.read(template.filePath);
}