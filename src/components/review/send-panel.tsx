"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmailProgress, SendBatchResult } from "@/types/review";

type Action = "next" | "retry";

type Props = {
  projectId: string;
  initial: EmailProgress;
  // Certificates that still have to be generated before sending can start.
  generationRemaining: number;
  smtpLabel: string | null;
  emailSubject: string | null;
  emailSaved: boolean;
  showResultsLink: boolean;
};

export function SendPanel({
  projectId,
  initial,
  generationRemaining,
  smtpLabel,
  emailSubject,
  emailSaved,
  showResultsLink,
}: Props) {
  const router = useRouter();
  const stopRef = useRef(false);

  const [progress, setProgress] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<Action | null>(null);

  const done = progress.sent + progress.failed;
  const percent = progress.total === 0 ? 0 : Math.round((done / progress.total) * 100);
  const started = done > 0;
  const allProcessed = progress.total > 0 && progress.remaining === 0;

  const blockers: string[] = [];
  if (generationRemaining > 0) {
    blockers.push("Generate all certificates before sending emails.");
  } else if (progress.total === 0) {
    blockers.push("No certificates have been generated yet.");
  }
  if (!smtpLabel) blockers.push("SMTP is not set up.");
  if (!emailSaved) blockers.push("The email subject and body are not saved yet.");
  const canSend = blockers.length === 0;

  const toSend = confirming === "retry" ? progress.failed : progress.remaining;

  // Keeps asking the server for the next batch until nothing is left.
  async function run(first: Action) {
    setConfirming(null);
    stopRef.current = false;
    setRunning(true);
    setError("");

    let action: Action = first;
    let previousSent = progress.sent;
    let failedStreak = 0;

    try {
      for (let i = 0; i < 500; i++) {
        const res = await fetch(`/api/projects/${projectId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, confirmed: true }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error ?? "Sending stopped. Please try again.");
          return;
        }

        const result = data as SendBatchResult;
        setProgress({
          total: result.total,
          sent: result.sent,
          failed: result.failed,
          remaining: result.remaining,
        });
        action = "next";

        if (result.remaining === 0) return;
        if (result.processed === 0) {
          setError("No progress was made. Please try again.");
          return;
        }

        // Two batches in a row without a single sent email means something is wrong.
        failedStreak = result.sent === previousSent ? failedStreak + 1 : 0;
        previousSent = result.sent;
        if (failedStreak >= 2) {
          setError(
            "Several emails in a row failed, so sending was paused. Check the failure reasons in the results and your SMTP settings, then resume."
          );
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Send Emails</CardTitle>
        <CardDescription>
          Each participant receives their own email with their certificate
          attached. Nothing is sent until you confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1" role="status">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-green-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">
            Sent: {progress.sent}. Failed: {progress.failed}. Waiting:{" "}
            {progress.remaining}. Total certificates: {progress.total}.
          </p>
        </div>

        {allProcessed && progress.failed === 0 && (
          <p className="text-sm text-green-700">All emails were sent.</p>
        )}
        {allProcessed && progress.failed > 0 && (
          <p className="text-sm text-amber-700">
            {progress.failed} email(s) failed. Open the results to see the
            reasons, then retry the failed emails. The certificates are not
            generated again.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!canSend && !allProcessed && (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!running && !started && (
            <Button disabled={!canSend} onClick={() => setConfirming("next")}>
              Send Certificates by Email
            </Button>
          )}

          {!running && started && progress.remaining > 0 && (
            <Button disabled={!canSend} onClick={() => setConfirming("next")}>
              Resume Sending
            </Button>
          )}

          {!running && allProcessed && progress.failed > 0 && (
            <Button disabled={!canSend} onClick={() => setConfirming("retry")}>
              Retry Failed Emails ({progress.failed})
            </Button>
          )}

          {running && (
            <>
              <Button disabled>Sending...</Button>
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

          {(showResultsLink || started) && (
            <Link
              href={`/projects/${projectId}/results`}
              className={buttonVariants({ variant: "outline" })}
            >
              View Results
            </Link>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Email providers limit how many emails you can send per day, and
          delivery is not guaranteed. Check your provider&apos;s limit before
          sending to a large list.
        </p>
      </CardContent>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send emails?</DialogTitle>
            <DialogDescription>
              You are about to email {toSend} participant(s) from {smtpLabel}{" "}
              with the subject &quot;{emailSubject}&quot;. Each person receives
              their own certificate. Sent emails cannot be recalled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button onClick={() => confirming && void run(confirming)}>
              Send {toSend} email(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}