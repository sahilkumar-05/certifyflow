"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DuplicateButton } from "@/components/projects/duplicate-button";
import type { ReviewContext } from "@/types/review";
import { GenerationPanel } from "./generation-panel";

// pdf.js needs the browser, so the preview is never rendered on the server.
const PdfPreview = dynamic(
  () => import("@/components/projects/pdf-preview").then((m) => m.PdfPreview),
  {
    ssr: false,
    loading: () => (
      <p className="py-10 text-center text-sm text-gray-500">Loading preview...</p>
    ),
  }
);

const selectClass =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

type Props = { projectId: string; context: ReviewContext };

export function ReviewStep({ projectId, context }: Props) {
  const [participantId, setParticipantId] = useState(context.participants[0]?.id ?? "");

  const { counts, fields, smtp } = context;
  const total = counts.valid + counts.invalid;

  const blockers: string[] = [];
  if (!context.templateName) blockers.push("No certificate template is uploaded.");
  if (counts.valid === 0) blockers.push("There are no valid participants.");
  if (fields.length === 0) {
    blockers.push("No fields are placed on the certificate. Add and save at least one field.");
  }

  const warnings: string[] = [];
  if (counts.invalid > 0) {
    warnings.push(`${counts.invalid} invalid record(s) will be skipped.`);
  }
  if (context.staleFields.length > 0) {
    warnings.push(
      `These fields use columns that are not in this spreadsheet and will be blank: ${context.staleFields.join(", ")}. Open Field Mapping and save to remove them.`
    );
  }
  if (!context.emailSaved) {
    warnings.push("The email subject and body are not saved yet. You need them before sending.");
  }
  if (!smtp) {
    warnings.push("SMTP is not set up. You need it before sending.");
  }

  const canGenerate = blockers.length === 0;
  const canPreview = canGenerate && !!participantId;

  const rows: [string, string][] = [
    ["Project", context.projectName],
    ["Event", context.eventName],
    ["Template", context.templateName ?? "Not uploaded"],
    ["Spreadsheet", context.spreadsheetName ?? "Not uploaded"],
    ["Total participants", String(total)],
    ["Valid records", String(counts.valid)],
    ["Invalid records (skipped)", String(counts.invalid)],
    ["Email subject", context.emailSubject ?? "Not saved yet"],
    [
      "SMTP account",
      smtp ? `${smtp.senderName} <${smtp.username}>` : "Not set up",
    ],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review</CardTitle>
              <CardDescription>
                Check everything before generating certificates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="divide-y rounded-lg border text-sm">
                {rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap justify-between gap-2 px-3 py-2"
                  >
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="max-w-full break-words text-right font-medium text-gray-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Field mapping</p>
                {fields.length === 0 ? (
                  <p className="text-sm text-gray-500">No fields yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-gray-700">
                    {fields.map((f, i) => (
                      <li key={`${f.label}-${i}`}>
                        {f.label}{" "}
                        <span className="text-gray-500">from column {f.source}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {blockers.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {blockers.map((b) => (
                    <li key={b} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {warnings.map((w) => (
                    <li key={w} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="max-w-sm text-sm text-gray-600">
                Sending to another group with the same design and email? Copy
                this project's template, field mapping and email text into a
                new project.
              </p>
              <DuplicateButton
                projectId={projectId}
                label="Duplicate for a new batch"
                size="default"
              />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Sample Certificate</CardTitle>
            <CardDescription>
              Generated on the server from your saved mapping, the same way
              every certificate will be.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canPreview ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="review-participant">Participant</Label>
                  <select
                    id="review-participant"
                    className={selectClass}
                    value={participantId}
                    onChange={(e) => setParticipantId(e.target.value)}
                  >
                    {context.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg bg-gray-100 p-3">
                  <PdfPreview
                    url={`/api/projects/${projectId}/sample?participantId=${encodeURIComponent(participantId)}`}
                    pageNumber={1}
                    onNumPages={() => {}}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                The preview appears once the template, participants and at
                least one field are ready.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <GenerationPanel
        projectId={projectId}
        initial={context.progress}
        canGenerate={canGenerate}
        hasSentEmails={context.hasSentEmails}
      />

      <div className="flex justify-start">
        <Link
          href={`/projects/${projectId}?step=5`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back
        </Link>
      </div>
    </div>
  );
}