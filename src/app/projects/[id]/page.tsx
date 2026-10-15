import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUserId } from "@/lib/session";
import { LAST_AVAILABLE_STEP } from "@/lib/wizard-steps";
import { getOwnedProject } from "@/services/project.service";
import { Badge } from "@/components/ui/badge";
import { WizardStepper } from "@/components/projects/wizard-stepper";
import { ProjectInfoStep } from "@/components/projects/project-info-step";
import { TemplateStep } from "@/components/projects/template-step";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) notFound();

  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) notFound();

  const sp = await searchParams;
  const rawStep = Array.isArray(sp.step) ? sp.step[0] : sp.step;
  const requested = Number(rawStep);
  const current =
    Number.isInteger(requested) &&
    requested >= 1 &&
    requested <= LAST_AVAILABLE_STEP
      ? requested
      : 1;

  const completed: Record<number, boolean> = {
    1: true,
    2: !!project.template,
  };

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
      </div>

      <WizardStepper
        projectId={project.id}
        current={current}
        completed={completed}
      />

      {current === 1 && (
        <ProjectInfoStep
          projectId={project.id}
          initial={{
            name: project.name,
            eventName: project.eventName,
            description: project.description ?? "",
          }}
        />
      )}

      {current === 2 && (
        <TemplateStep projectId={project.id} template={project.template} />
      )}
    </div>
  );
}