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
import { clamp01 } from "@/lib/mapping/coordinates";
import { createField } from "@/lib/mapping/defaults";
import { COLUMN_DRAG_TYPE } from "@/lib/mapping/drag";
import {
  MAX_MAPPING_FIELDS,
  type FieldConfig,
} from "@/lib/validation/mapping";
import type { MappingContext } from "@/types/mapping";
import { FieldProperties } from "./field-properties";

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

const round4 = (n: number) => Math.round(n * 10000) / 10000;

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

  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const dirty = JSON.stringify(fields) !== savedJson;

  // For each column: how many participants have no value in it.
  const emptyByColumn = useMemo(() => {
    const out: Record<string, number> = {};
    for (const col of context.columns) {
      out[col] = context.participants.filter(
        (p) => !(p.values[col] ?? "").trim()
      ).length;
    }
    return out;
  }, [context.columns, context.participants]);

  // Fields that are blank for the participant shown in the preview.
  const missingForCurrent = participant
    ? fields.filter((f) => !(participant.values[f.source] ?? "").trim())
    : [];

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Keyboard shortcuts for the selected field.
  useEffect(() => {
    if (!selectedId) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setFields((prev) => prev.filter((f) => f.id !== selectedId));
        setSelectedId(null);
        setMessage("");
        return;
      }

      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }

      const step = e.shiftKey ? 0.01 : 0.001;
      const delta =
        e.key === "ArrowLeft"
          ? { x: -step, y: 0 }
          : e.key === "ArrowRight"
            ? { x: step, y: 0 }
            : e.key === "ArrowUp"
              ? { x: 0, y: -step }
              : e.key === "ArrowDown"
                ? { x: 0, y: step }
                : null;

      if (delta) {
        e.preventDefault();
        setFields((prev) =>
          prev.map((f) =>
            f.id === selectedId
              ? {
                  ...f,
                  x: round4(clamp01(f.x + delta.x)),
                  y: round4(clamp01(f.y + delta.y)),
                }
              : f
          )
        );
        setMessage("");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  function addField(column: string, position?: { x: number; y: number }) {
    if (fields.length >= MAX_MAPPING_FIELDS) {
      setError(`You can add up to ${MAX_MAPPING_FIELDS} fields.`);
      return;
    }
    const field = createField(column, fields.length, position);
    setFields([...fields, field]);
    setSelectedId(field.id);
    setError("");
    setMessage("");
  }

  function updateField(id: string, patch: Partial<FieldConfig>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setMessage("");
  }

  function moveField(id: string, x: number, y: number) {
    updateField(id, { x: round4(clamp01(x)), y: round4(clamp01(y)) });
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
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

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Left panel: available columns and fields on the certificate */}
        <div className="space-y-4">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Available Fields</CardTitle>
              <CardDescription>
                Drag a column onto the certificate, or click it to add.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {context.columns.map((col) => {
                const used = fields.filter((f) => f.source === col).length;
                return (
                  <div
                    key={col}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(COLUMN_DRAG_TYPE, col);
                      e.dataTransfer.setData("text/plain", col);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => addField(col)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        addField(col);
                      }
                    }}
                    className="flex cursor-grab items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-indigo-50 active:cursor-grabbing"
                  >
                    <span className="truncate">{col}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                      {used > 0 && <span>{used} used</span>}
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">On Certificate</CardTitle>
              <CardDescription>
                {fields.length === 0
                  ? "No fields yet."
                  : "Select a field to edit it."}
              </CardDescription>
            </CardHeader>
            {fields.length > 0 && (
              <CardContent className="space-y-2">
                {fields.map((f) => {
                  const empty = emptyByColumn[f.source] ?? 0;
                  return (
                    <div
                      key={f.id}
                      className={[
                        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                        f.id === selectedId
                          ? "border-indigo-500 bg-indigo-50"
                          : "bg-white",
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
                        {empty > 0 && (
                          <span className="block text-xs text-amber-700">
                            {empty} empty
                          </span>
                        )}
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
                  );
                })}
              </CardContent>
            )}
          </Card>
        </div>

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

            {missingForCurrent.length > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                {participant?.name} has no value for:{" "}
                {missingForCurrent.map((f) => f.label).join(", ")}. These fields
                show their placeholder here and would be blank on the certificate.
              </p>
            )}

            <div className="rounded-lg bg-gray-100 p-3">
              <CertificateCanvas
                fileUrl={`/api/projects/${projectId}/template/file`}
                pageNumber={context.page.pageNumber}
                page={{ width: context.page.width, height: context.page.height }}
                fields={fields}
                selectedId={selectedId}
                sampleValues={participant?.values ?? {}}
                onSelect={setSelectedId}
                onMove={moveField}
                onDropColumn={(column, x, y) =>
                  addField(column, { x: round4(x), y: round4(y) })
                }
              />
            </div>

            <p className="text-xs text-gray-500">
              Drag a field to move it. Arrow keys nudge the selected field (hold
              Shift for bigger steps), Delete removes it, Escape deselects.
            </p>
          </CardContent>
        </Card>

        {/* Right panel: properties of the selected field */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Field Properties</CardTitle>
            <CardDescription>
              {selected
                ? "Changes apply to every certificate."
                : "Select a field on the certificate to edit its font, size, color and position."}
            </CardDescription>
          </CardHeader>
          {selected && (
            <CardContent>
              <FieldProperties
                key={selected.id}
                field={selected}
                columns={context.columns}
                participantCount={context.participants.length}
                emptyCount={emptyByColumn[selected.source] ?? 0}
                onChange={(patch) => updateField(selected.id, patch)}
                onDelete={() => removeField(selected.id)}
              />
            </CardContent>
          )}
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