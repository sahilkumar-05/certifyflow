import { prisma } from "@/lib/prisma";
import type { ProjectInput } from "@/lib/validation/project";

export async function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      eventName: true,
      status: true,
      createdAt: true,
    },
  });
}

// Ownership check: returns null if the project does not belong to the user.
export async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      template: { select: { id: true, originalFileName: true } },
      _count: { select: { participants: true, certificates: true } },
    },
  });
}

export async function createProject(userId: string, input: ProjectInput) {
  return prisma.project.create({
    data: {
      userId,
      name: input.name,
      eventName: input.eventName,
      description: input.description,
    },
    select: { id: true },
  });
}

// Returns true if a project was deleted, false if not found / not owned.
export async function deleteOwnedProject(projectId: string, userId: string) {
  const result = await prisma.project.deleteMany({
    where: { id: projectId, userId },
  });
  return result.count > 0;
}