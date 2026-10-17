"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileSpreadsheet } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MAX_SPREADSHEET_ROWS,
  MAX_SPREADSHEET_SIZE_BYTES,
  MAX_SPREADSHEET_SIZE_MB,
} from "@/lib/constants";
import { uploadWithProgress } from "@/lib/upload-client";
import type { SheetInfo, ValidationSummary } from "@/types/spreadsheet";

type Mapping = { name: string; email: string; reference: string };

type ValidationResult = {
  key: string;
  summary?: ValidationSummary;
  error?: string;
};

type Props = {
  projectId: string;
  initialInfo: SheetInfo | null;
  initialError: string;
  savedCounts: { valid: number; invalid: number } | null;
};

const selectClass =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60";

function toMapping(m: SheetInfo["mapping"]): Mapping {
  return { name: m.nameColumn, email: m.emailColumn, reference: m.referenceColumn };
}

export function SpreadsheetStep({
  projectId,
  initialInfo,
  initialError,
  savedCounts,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState<SheetInfo | null>(initialInfo);
  const [mapping, setMapping] = useState<Mapping>(
    initialInfo
      ? toMapping(initialInfo.mapping)
      : { name: "", email: "", reference: "" }
  );
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [error, setError] = useState(initialError);
  const [saved, setSaved] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const uploading = progress !== null;

  // Everything the server needs to validate the current selection.
  const canValidate =
    !!info && !!mapping.name && !!mapping.email && mapping.name !== mapping.email;
  const payloadJson = JSON.stringify({
    sheetName: info?.sheetName ?? "",
    nameColumn: mapping.name,
    emailColumn: mapping.email,
    referenceColumn: mapping.reference || null,
  });
  const validationKey = `${dataVersion}:${payloadJson}`;

  // Results that belong to an older selection are ignored.
  const current = result?.key === validationKey ? result : null;
  const summary = current?.summary ?? null;
  const checking = canValidate && !current;
  const canSave =
    canValidate && !!summary && summary.validCount > 0 && !saving && !uploading && !sheetLoading;

  useEffect(() => {
    if (!canValidate) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/participants/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadJson,
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setResult(
          res.ok
            ? { key: validationKey, summary: data }
            : { key: validationKey, error: data.error ?? "Could not validate the records." }
        );
      } catch {
        if (!cancelled) {
          setResult({ key: validationKey, error: "Network error. Please try again." });
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [canValidate, validationKey, payloadJson, projectId]);

  function applyInfo(next: SheetInfo) {
    setInfo(next);
    setMapping(toMapping(next.mapping));
    setResult(null);
    setDataVersion((v) => v + 1);
  }

  async function handleFile(file: File) {
    setError("");
    setSaved("");

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
      setError("Only .xlsx and .csv files are accepted.");
      return;
    }
    if (file.size === 0) {
      setError("The file is empty.");
      return;
    }
    if (file.size > MAX_SPREADSHEET_SIZE_BYTES) {
      setError(`File must be ${MAX_SPREADSHEET_SIZE_MB} MB or smaller.`);
      return;
    }

    setProgress(0);
    try {
      const res = await uploadWithProgress<SheetInfo>(
        `/api/projects/${projectId}/spreadsheet`,
        file,
        setProgress
      );

      if (res.status !== 201) {
        setError(res.body.error ?? "Upload failed. Please try again.");
        return;
      }

      applyInfo(res.body);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  async function changeSheet(name: string) {
    if (!info || name === info.sheetName) return;
    setError("");
    setSaved("");
    setSheetLoading(true);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/spreadsheet?sheet=${encodeURIComponent(name)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not load this worksheet.");
        return;
      }
      applyInfo(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSheetLoading(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    setSaved("");

    try {
      const res = await fetch(`/api/projects/${projectId}/participants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payloadJson,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save participants.");
        return;
      }
      setSaved(
        `Saved ${data.validCount} valid and ${data.invalidCount} invalid records.`
      );
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function roleOf(header: string): string {
    if (header === mapping.name) return "Name";
    if (header === mapping.email) return "Email";
    if (header === mapping.reference) return "Reference";
    return "";
  }

  const savedMessage =
    saved ||
    (savedCounts
      ? `${savedCounts.valid} valid and ${savedCounts.invalid} invalid participants are saved.`
      : "");

  const hasData = !!info && info.headers.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Participant Spreadsheet</CardTitle>
        <CardDescription>
          Upload an .xlsx or .csv file (up to {MAX_SPREADSHEET_SIZE_MB} MB and{" "}
          {MAX_SPREADSHEET_ROWS} rows). The first row should contain column
          names.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <input
          id="spreadsheet-input"
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />

        {!info ? (
          <label
            htmlFor="spreadsheet-input"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && !uploading) void handleFile(file);
            }}
            className={[
              "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center",
              dragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300",
            ].join(" ")}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium text-gray-900">
              Click to choose a spreadsheet, or drag and drop it here
            </span>
            <span className="text-xs text-gray-500">
              Supported formats: .xlsx and .csv
            </span>
          </label>
        ) : (
          <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{info.fileName}</p>
                <p className="text-xs text-gray-500">
                  {info.totalRows} data row{info.totalRows === 1 ? "" : "s"} detected
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                Replace file
              </Button>
            </div>

            {info.sheetNames.length > 1 && (
              <div className="max-w-xs space-y-1">
                <Label htmlFor="sheet-select">Worksheet</Label>
                <select
                  id="sheet-select"
                  className={selectClass}
                  value={info.sheetName}
                  disabled={sheetLoading || uploading}
                  onChange={(e) => void changeSheet(e.target.value)}
                >
                  {info.sheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Replacing the file removes the saved participants. Your field
              mapping and email text are kept for columns that still exist in
              the new file.
            </p>
          </div>
        )}

        {uploading && (
          <div className="space-y-1" role="status">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {progress === 100 ? "Reading spreadsheet..." : `Uploading... ${progress}%`}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {info && !hasData && (
          <p className="text-sm text-gray-600">
            This worksheet has no data. Choose another worksheet or upload a
            different file.
          </p>
        )}

        {info && hasData && (
          <>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Column mapping</h3>
                <p className="text-xs text-gray-500">
                  Tell CertifyFlow which columns hold the participant details.
                  Name and Email are required.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="map-name">Name column</Label>
                  <select
                    id="map-name"
                    className={selectClass}
                    value={mapping.name}
                    onChange={(e) => setMapping((m) => ({ ...m, name: e.target.value }))}
                  >
                    <option value="">Select a column</option>
                    {info.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="map-email">Email column</Label>
                  <select
                    id="map-email"
                    className={selectClass}
                    value={mapping.email}
                    onChange={(e) => setMapping((m) => ({ ...m, email: e.target.value }))}
                  >
                    <option value="">Select a column</option>
                    {info.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="map-ref">Reference number (optional)</Label>
                  <select
                    id="map-ref"
                    className={selectClass}
                    value={mapping.reference}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, reference: e.target.value }))
                    }
                  >
                    <option value="">None</option>
                    {info.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {!mapping.name || !mapping.email ? (
                <p className="text-sm text-gray-500">
                  Select the Name and Email columns to validate the records.
                </p>
              ) : mapping.name === mapping.email ? (
                <p className="text-sm text-red-600">
                  Name and Email must use different columns.
                </p>
              ) : checking ? (
                <p className="text-sm text-gray-500">Checking records...</p>
              ) : current?.error ? (
                <p className="text-sm text-red-600">{current.error}</p>
              ) : summary ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-white p-4">
                      <p className="text-xs text-gray-500">Total rows</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {summary.totalRows}
                      </p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <p className="text-xs text-green-700">Valid records</p>
                      <p className="text-xl font-semibold text-green-800">
                        {summary.validCount}
                      </p>
                    </div>
                    <div
                      className={[
                        "rounded-lg border p-4",
                        summary.invalidCount > 0
                          ? "border-red-200 bg-red-50"
                          : "bg-white",
                      ].join(" ")}
                    >
                      <p
                        className={[
                          "text-xs",
                          summary.invalidCount > 0 ? "text-red-700" : "text-gray-500",
                        ].join(" ")}
                      >
                        Invalid records
                      </p>
                      <p
                        className={[
                          "text-xl font-semibold",
                          summary.invalidCount > 0 ? "text-red-800" : "text-gray-900",
                        ].join(" ")}
                      >
                        {summary.invalidCount}
                      </p>
                    </div>
                  </div>

                  {summary.validCount === 0 && (
                    <p className="text-sm text-red-600">
                      There are no valid records. Check the selected columns or
                      fix the spreadsheet.
                    </p>
                  )}

                  {summary.invalidCount > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">
                        Invalid records
                      </p>
                      <p className="text-xs text-gray-500">
                        These rows are saved but will be skipped when
                        certificates are generated and sent.
                        {summary.invalidCount > summary.invalidRows.length &&
                          ` Showing the first ${summary.invalidRows.length} of ${summary.invalidCount}.`}
                      </p>
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Row</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Problem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.invalidRows.map((r) => (
                              <TableRow key={r.rowNumber}>
                                <TableCell>{r.rowNumber}</TableCell>
                                <TableCell className="max-w-60 truncate">
                                  {r.name || "-"}
                                </TableCell>
                                <TableCell className="max-w-60 truncate">
                                  {r.email || "-"}
                                </TableCell>
                                <TableCell className="text-red-700">
                                  {r.errors.join(", ")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">Preview</h3>
              {info.totalRows === 0 ? (
                <p className="text-sm text-gray-600">
                  No data rows were found below the header row.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    Showing the first {info.previewRows.length} of {info.totalRows} rows.
                  </p>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {info.headers.map((h) => {
                            const role = roleOf(h);
                            return (
                              <TableHead key={h} className="whitespace-nowrap">
                                {h}
                                {role && (
                                  <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                                    {role}
                                  </span>
                                )}
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {info.previewRows.map((row, i) => (
                          <TableRow key={i}>
                            {info.headers.map((h) => (
                              <TableCell key={h} className="max-w-60 truncate">
                                {row[h]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {savedMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{savedMessage}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            href={`/projects/${projectId}?step=2`}
            className={buttonVariants({ variant: "outline" })}
          >
            Back
          </Link>
          <div className="flex items-center gap-2">
            {hasData && (
              <Button onClick={handleSave} disabled={!canSave}>
                {saving ? "Saving..." : "Save Participants"}
              </Button>
            )}
            {savedMessage && (
              <Link
                href={`/projects/${projectId}?step=4`}
                className={buttonVariants()}
              >
                Continue
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}