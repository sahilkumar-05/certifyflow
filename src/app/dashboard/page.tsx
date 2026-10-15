import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/services/stats.service";
import { listProjects } from "@/services/project.service";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ProjectsList } from "@/components/projects/projects-list";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [stats, projects] = await Promise.all([
    getDashboardStats(userId),
    listProjects(userId),
  ]);

  const rows = projects.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome, {session?.user?.name}
        </h1>
        <p className="text-gray-600">
          Overview of your certificate projects.
        </p>
      </div>

      <StatsCards stats={stats} />
      <ProjectsList projects={rows} />
    </div>
  );
}