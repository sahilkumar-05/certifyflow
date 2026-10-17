import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUserId } from "@/lib/session";
import { getResults, type ResultsFilter } from "@/services/results.service";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendPanel } from "@/components/review/send-panel";
import { ResultsTable } from "@/components/review/results-table";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[]; filter?: string | string[] }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(first(sp.page))) || 1);
  const filter: ResultsFilter = first(sp.filter) === "failed" ? "failed" : "all";

  const data = await getResults(userId, id, page, filter);
  if (!data) notFound();

  const { generation, email } = data;

  const status =
    generation.remaining > 0
      ? "Certificates are not fully generated"
      : email.total === 0
        ? "No certificates generated yet"
        : email.remaining > 0
          ? "Emails are waiting to be sent"
          : "Completed";

  const stats = [
    { label: "Total Participants", value: generation.total },
    { label: "Certificates Generated", value: generation.generated },
    { label: "Emails Sent", value: email.sent },
    { label: "Emails Failed", value: email.failed },
  ];

  const href = (p: number, f: ResultsFilter) =>
    `/projects/${id}/results?filter=${f}&page=${p}`;

  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${id}?step=6`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to review
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {status === "Completed" ? "Certificate Generation Completed" : "Results"}
        </h1>
        <p className="mt-1 text-gray-600">
          {data.projectName} - {data.eventName}
        </p>
        <p className="mt-1 text-sm text-gray-500">Status: {status}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(data.invalidCount > 0 || generation.failed > 0) && (
        <p className="text-sm text-gray-600">
          {data.invalidCount > 0 &&
            `${data.invalidCount} invalid record(s) were skipped. `}
          {generation.failed > 0 &&
            `${generation.failed} certificate(s) failed to generate. Go back to the review step to retry them.`}
        </p>
      )}

      <SendPanel
        projectId={id}
        initial={email}
        generationRemaining={generation.remaining}
        smtpLabel={data.smtpLabel}
        emailSubject={data.emailSubject}
        emailSaved={data.emailSaved}
        showResultsLink={false}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Participants</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={href(1, "all")}
              className={buttonVariants({
                variant: filter === "all" ? "default" : "outline",
                size: "sm",
              })}
            >
              All
            </Link>
            <Link
              href={href(1, "failed")}
              className={buttonVariants({
                variant: filter === "failed" ? "default" : "outline",
                size: "sm",
              })}
            >
              Failed only
            </Link>
            {generation.generated > 0 && (
              <a
                href={`/api/projects/${id}/certificates/zip`}
                className={buttonVariants({ size: "sm" })}
              >
                Download all as ZIP
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ResultsTable projectId={id} rows={data.rows} />

          {data.pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t p-4">
              {data.page > 1 ? (
                <Link
                  href={href(data.page - 1, filter)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <p className="text-sm text-gray-600">
                Page {data.page} of {data.pageCount} ({data.matching} participants)
              </p>
              {data.page < data.pageCount ? (
                <Link
                  href={href(data.page + 1, filter)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}