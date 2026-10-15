import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/services/stats.service";
import { StatsCards } from "@/components/dashboard/stats-cards";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const stats = await getDashboardStats(userId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome, {session?.user?.name}
        </h1>
        <p className="text-gray-600">
          Apne certificate projects ka overview yahan dekho.
        </p>
      </div>

      <StatsCards stats={stats} />
    </div>
  );
}