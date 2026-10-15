import { prisma } from "@/lib/prisma";

export type DashboardStats = {
  totalProjects: number;
  certificatesGenerated: number;
  emailsSent: number;
  failedEmails: number;
};

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [totalProjects, certificatesGenerated, emailsSent, failedEmails] =
    await Promise.all([
      prisma.project.count({ where: { userId } }),
      prisma.certificate.count({
        where: { generationStatus: "GENERATED", project: { userId } },
      }),
      prisma.certificate.count({
        where: { emailStatus: "SENT", project: { userId } },
      }),
      prisma.certificate.count({
        where: { emailStatus: "FAILED", project: { userId } },
      }),
    ]);

  return { totalProjects, certificatesGenerated, emailsSent, failedEmails };
}