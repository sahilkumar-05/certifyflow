import { FolderOpen, FileCheck2, Mail, MailWarning } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/services/stats.service";

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const items = [
    {
      label: "Total Projects",
      value: stats.totalProjects,
      icon: FolderOpen,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Certificates Generated",
      value: stats.certificatesGenerated,
      icon: FileCheck2,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Emails Sent",
      value: stats.emailsSent,
      icon: Mail,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Failed Emails",
      value: stats.failedEmails,
      icon: MailWarning,
      color: "bg-red-50 text-red-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-4 p-5">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.color}`}
            >
              <item.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{item.label}</p>
              <p className="text-2xl font-semibold text-gray-900">
                {item.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}