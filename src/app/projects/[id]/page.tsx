import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUserId } from "@/lib/session";
import { getOwnedProject } from "@/services/project.service";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) notFound();

  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            {project.name}
          </h1>
          <Badge className="bg-gray-100 text-gray-700">{project.status}</Badge>
        </div>
        <p className="mt-1 text-gray-600">Event: {project.eventName}</p>
        {project.description && (
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            {project.description}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project setup</CardTitle>
          <CardDescription>
            Template upload, spreadsheet upload and field mapping will appear
            here in the next steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
          <p>
            Template:{" "}
            {project.template ? project.template.originalFileName : "Not uploaded"}
          </p>
          <p>Participants: {project._count.participants}</p>
          <p>Certificates: {project._count.certificates}</p>
        </CardContent>
      </Card>
    </div>
  );
}