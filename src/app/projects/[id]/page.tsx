import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUserId } from "@/lib/session";
import { LAST_AVAILABLE_STEP } from "@/lib/wizard-steps";
import { SpreadsheetValidationError } from "@/lib/excel/types";
import { parseStoredMapping } from "@/lib/mapping/parse";
import { getOwnedProject } from "@/services/project.service";
import {
  getParticipantCounts,
  getSheetInfo,
} from "@/services/participant.service";
import { getMappingContext } from "@/services/mapping.service";
import type { SheetInfo } from "@/types/spreadsheet";
import type { MappingContextResult } from "@/types/mapping";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WizardStepper } from "@/components/projects/wizard-stepper";
import { ProjectInfoStep } from "@/components/projects/project-info-step";
import { TemplateStep } from "@/components/projects/template-step";
import { SpreadsheetStep } from "@/components/projects/spreadsheet-step";
import { MappingEditor } from "@/components/certificate-editor/mapping-editor";

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

  const counts = await getParticipantCounts(project.id);
  const savedCounts = counts.valid + counts.invalid > 0 ? counts : null;

  const completed: Record<number, boolean> = {
    1: true,
    2: !!project.template,
    3: counts.valid > 0,
    4: parseStoredMapping(project.template?.fieldMapping).fields.length > 0,
  };

  // The spreadsheet is only parsed when the spreadsheet step is open.
  let sheetInfo: SheetInfo | null = null;
  let sheetError = "";
  if (current === 3) {
    try {
      sheetInfo = await getSheetInfo(userId, project.id);
    } catch (err) {
      sheetError =
        err instanceof SpreadsheetValidationError
          ? err.message
          : "The saved spreadsheet could not be loaded. Please upload it again.";
    }
  }

  // The mapping data is only loaded when the mapping step is open.
  let mappingResult: MappingContextResult | null = null;
  let mappingError = "";
  if (current === 4) {
    try {
      mappingResult = await getMappingContext(userId, project.id);
    } catch (err) {
      mappingError =
        err instanceof SpreadsheetValidationError
          ? err.message
          : "The editor data could not be loaded. Please try again.";
    }
  }

  const blocked = mappingResult && !mappingResult.ok ? mappingResult.reason : null;
  const blockedMessage =
    mappingError ||
    (blocked === "template"
      ? "Upload a certificate template first."
      : "Save at least one valid participant first.");

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

      {current === 3 && (
        <SpreadsheetStep
          projectId={project.id}
          initialInfo={sheetInfo}
          initialError={sheetError}
          savedCounts={savedCounts}
        />
      )}

      {current === 4 &&
        (mappingResult?.ok ? (
          <MappingEditor projectId={project.id} context={mappingResult.data} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Field Mapping</CardTitle>
              <CardDescription>{blockedMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/projects/${project.id}?step=${blocked === "template" ? 2 : 3}`}
                className={buttonVariants()}
              >
                {blocked === "template" ? "Go to Template" : "Go to Spreadsheet"}
              </Link>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}