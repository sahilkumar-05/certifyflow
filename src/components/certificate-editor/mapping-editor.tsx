"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { fontFaceCss } from "@/lib/fonts";
import { createField } from "@/lib/mapping/defaults";
import {
  MAX_MAPPING_FIELDS,
  type FieldConfig,
} from "@/lib/validation/mapping";
import type { MappingContext } from "@/types/mapping";

// pdf.js needs the browser, so the canvas is never rendered on the server.
const CertificateCanvas = dynamic(
  () => import("./certificate-canvas").then((m) => m.CertificateCanvas),
  {
    ssr: false,
    loading: () => (
      <p className="py-10 text-center text-sm text-gray-500">Loading editor...</p>
    ),
  }
);

const selectClass =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

type Props = { projectId: string; context: MappingContext };

export function MappingEditor({ projectId, context }: Props) {
  const router = useRouter();

  const [fields, setFields] = useState<FieldConfig[]>(context.mapping.fields);
  const [savedJson, setSavedJson] = useState(JSON.stringify(context.mapping.fields));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState(context.participants[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const participant = useMemo(
    () => context.participants.find((p) => p.id === participantId) ?? null,
    [context.participants, participantId]
  );

  const dirty = JSON.stringify(fields) !== savedJson;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function addField(column: string) {
    if (fields.length >= MAX_MAPPING_FIELDS) return;
    const field = createField(column, fields.length);
    setFields([...fields, field]);
    setSelectedId(field.id);
    setMessage("");
  }

  function removeField(id: string) {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
    setMessage("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/projects/${projectId}/mapping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, fields }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Could not save the mapping.");
        return;
      }
      setSavedJson(JSON.stringify(fields));
      setMessage("Mapping saved.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <style>{fontFaceCss()}</style>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        {/* Left panel: available fields */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Available Fields</CardTitle>
            <CardDescription>
              Columns from your spreadsheet. Click a column to add it to the
              certificate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {context.columns.map((col) => {
              const used = fields.filter((f) => f.source === col).length;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => addField(col)}
                  disabled={fields.length >= MAX_MAPPING_FIELDS}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm hover:bg-indigo-50 disabled:opacity-50"
                >
                  <span className="truncate">{col}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                    {used > 0 && <span>{used} used</span>}
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Center panel: certificate */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="w-full max-w-xs space-y-1">
                <Label htmlFor="preview-participant">Preview participant</Label>
                <select
                  id="preview-participant"
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
              <p className="text-xs text-gray-500">
                Page {context.page.pageNumber}, {context.page.width} x{" "}
                {context.page.height} pt
              </p>
            </div>

            <div className="rounded-lg bg-gray-100 p-3">
              <CertificateCanvas
                fileUrl={`/api/projects/${projectId}/template/file`}
                pageNumber={context.page.pageNumber}
                page={{ width: context.page.width, height: context.page.height }}
                fields={fields}
                selectedId={selectedId}
                sampleValues={participant?.values ?? {}}
                onSelect={setSelectedId}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right panel: fields on the certificate */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Fields on Certificate</CardTitle>
            <CardDescription>
              {fields.length === 0
                ? "No fields yet. Add a column from the left."
                : "Select a field to highlight it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {fields.map((f) => (
              <div
                key={f.id}
                className={[
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                  f.id === selectedId ? "border-indigo-500 bg-indigo-50" : "bg-white",
                ].join(" ")}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelectedId(f.id)}
                >
                  <span className="block truncate font-medium text-gray-900">
                    {f.label}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    Column: {f.source}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Remove ${f.label}`}
                  onClick={() => removeField(f.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/projects/${projectId}?step=3`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back
        </Link>

        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && message && !dirty && (
            <p className="text-sm text-green-700">{message}</p>
          )}
          {dirty && !error && (
            <p className="text-sm text-amber-700">Unsaved changes</p>
          )}
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Saving..." : "Save Mapping"}
          </Button>
        </div>
      </div>
    </div>
  );
}