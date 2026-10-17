"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BatchResult, GenerationProgress } from "@/types/review";

type Action = "next" | "retry" | "reset";

type Props = {
  projectId: string;
  initial: GenerationProgress;
  canGenerate: boolean;
  hasSentEmails: boolean;
};

function toProgress(r: GenerationProgress): GenerationProgress {
  return {
    total: r.total,
    generated: r.generated,
    failed: r.failed,
    remaining: r.remaining,
  };
}

export function GenerationPanel({
  projectId,
  initial,
  canGenerate,
  hasSentEmails,
}: Props) {
  const router = useRouter();
  const stopRef = useRef(false);

  const [progress, setProgress] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const done = progress.generated + progress.failed;
  const percent = progress.total === 0 ? 0 : Math.round((done / progress.total) * 100);
  const started = done > 0;
  const finished = progress.total > 0 && progress.remaining === 0;

  async function call(action: Action) {
    const res = await fetch(`/api/projects/${projectId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  // Keeps asking the server for the next batch until nothing is left.
  async function run(first: "next" | "retry") {
    stopRef.current = false;
    setRunning(true);
    setError("");

    let action: "next" | "retry" = first;
    try {
      for (let i = 0; i < 500; i++) {
        const { ok, data } = await call(action);
        if (!ok) {
          setError(data.error ?? "Generation stopped. Please try again.");
          return;
        }

        const result = data as BatchResult;
        setProgress(toProgress(result));
        action = "next";

        if (result.remaining === 0) return;
        if (result.processed === 0) {
          setError("No progress was made. Please try again.");
          return;
        }
        if (stopRef.current) return;
      }
    } catch {
      setError("Network error. Click Resume to continue.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  async function reset() {
    if (
      !window.confirm(
        "Delete all generated certificates and generate them again using the current settings?"
      )
    ) {
      return;
    }

    setRunning(true);
    setError("");
    try {
      const { ok, data } = await call("reset");
      if (!ok) {
        setError(data.error ?? "Could not reset the certificates.");
        return;
      }
      setProgress(toProgress(data as BatchResult));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Generate Certificates</CardTitle>
        <CardDescription>
          Certificates are created from your saved field mapping, in small
          batches. Nothing is emailed from this page yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1" role="status">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">
            {done} of {progress.total} processed. Generated: {progress.generated}.
            Failed: {progress.failed}.
          </p>
        </div>

        {finished && progress.failed === 0 && (
          <p className="text-sm text-green-700">
            All certificates were generated.
          </p>
        )}
        {finished && progress.failed > 0 && (
          <p className="text-sm text-amber-700">
            {progress.failed} certificate(s) failed. You can retry them.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {!running && !started && (
            <Button disabled={!canGenerate || progress.total === 0} onClick={() => run("next")}>
              Generate Certificates
            </Button>
          )}

          {!running && started && progress.remaining > 0 && (
            <Button disabled={!canGenerate} onClick={() => run("next")}>
              Resume
            </Button>
          )}

          {!running && finished && progress.failed > 0 && (
            <Button disabled={!canGenerate} onClick={() => run("retry")}>
              Retry failed ({progress.failed})
            </Button>
          )}

          {running && (
            <>
              <Button disabled>Generating...</Button>
              <Button
                variant="outline"
                onClick={() => {
                  stopRef.current = true;
                }}
              >
                Stop after this batch
              </Button>
            </>
          )}

          {!running && started && !hasSentEmails && (
            <Button variant="outline" onClick={reset}>
              Regenerate all
            </Button>
          )}
        </div>

        {started && hasSentEmails && (
          <p className="text-xs text-gray-500">
            Emails were already sent, so these certificates can no longer be
            regenerated. Duplicate the project to start a new batch.
          </p>
        )}
      </CardContent>
    </Card>
  );
}