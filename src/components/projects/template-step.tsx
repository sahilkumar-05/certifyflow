"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileUp } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB } from "@/lib/constants";

// pdf.js needs the browser, so the preview is never rendered on the server.
const PdfPreview = dynamic(
  () => import("./pdf-preview").then((m) => m.PdfPreview),
  {
    ssr: false,
    loading: () => (
      <p className="py-10 text-center text-sm text-gray-500">
        Loading preview...
      </p>
    ),
  }
);

type TemplateInfo = {
  originalFileName: string;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
};

type UploadResult = {
  status: number;
  body: { error?: string; pageNumber?: number };
};

// fetch() cannot report upload progress, so XMLHttpRequest is used here.
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      let body: UploadResult["body"] = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON response: keep the empty body.
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("Network error"));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

type Props = { projectId: string; template: TemplateInfo | null };

export function TemplateStep({ projectId, template }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(template?.pageNumber ?? 1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageSaving, setPageSaving] = useState(false);

  const uploading = progress !== null;

  async function handleFile(file: File) {
    setError("");

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted.");
      return;
    }
    if (file.size === 0) {
      setError("The file is empty.");
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      setError(`PDF must be ${MAX_PDF_SIZE_MB} MB or smaller.`);
      return;
    }

    setProgress(0);
    try {
      const result = await uploadWithProgress(
        `/api/projects/${projectId}/template`,
        file,
        setProgress
      );

      if (result.status !== 201) {
        setError(result.body.error ?? "Upload failed. Please try again.");
        return;
      }

      setVersion((v) => v + 1);
      setPage(result.body.pageNumber ?? 1);
      setNumPages(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  async function changePage(next: number) {
    if (!numPages || next < 1 || next > numPages || next === page) return;
    if (pageSaving) return;

    const previous = page;
    setPage(next);
    setPageSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPage(previous);
        setError(data.error ?? "Could not change the page.");
        return;
      }
      router.refresh();
    } catch {
      setPage(previous);
      setError("Network error. Please try again.");
    } finally {
      setPageSaving(false);
    }
  }

  const fileInput = (
    <input
      id="pdf-input"
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      className="sr-only"
      disabled={uploading}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void handleFile(file);
      }}
    />
  );

  const progressBar = uploading && (
    <div className="space-y-1" role="status">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full bg-indigo-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {progress === 100 ? "Checking PDF..." : `Uploading... ${progress}%`}
      </p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Certificate Template</CardTitle>
        <CardDescription>
          Upload your PDF certificate design (PDF only, up to {MAX_PDF_SIZE_MB}{" "}
          MB). The original file is never modified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {fileInput}

        {!template ? (
          <label
            htmlFor="pdf-input"
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
              <FileUp className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium text-gray-900">
              Click to choose a PDF, or drag and drop it here
            </span>
            <span className="text-xs text-gray-500">
              Single-page certificates work best
            </span>
          </label>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {template.originalFileName}
              </p>
              <p className="text-xs text-gray-500">
                Page size: {template.pageWidth} x {template.pageHeight} pt (
                {template.pageWidth >= template.pageHeight
                  ? "landscape"
                  : "portrait"}
                )
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Replace PDF
            </Button>
          </div>
        )}

        {progressBar}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {template && (
          <div className="space-y-3">
            {numPages !== null && numPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || pageSaving}
                  onClick={() => changePage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-700">
                  Template page {page} of {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= numPages || pageSaving}
                  onClick={() => changePage(page + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="rounded-lg bg-gray-100 p-3">
              <PdfPreview
                url={`/api/projects/${projectId}/template/file?v=${version}`}
                pageNumber={page}
                onNumPages={setNumPages}
              />
            </div>
          </div>
        )}

        <div className="flex justify-start pt-2">
          <Link
            href={`/projects/${projectId}?step=1`}
            className={buttonVariants({ variant: "outline" })}
          >
            Back
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}