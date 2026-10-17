"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RESERVED_PLACEHOLDERS,
  buildVariables,
  findUnknownPlaceholders,
  renderSubject,
  renderTemplate,
} from "@/lib/email/template";
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH } from "@/lib/validation/email";
import type { EmailContext } from "@/types/email";

const selectClass =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

type TestResult = {
  ok: boolean;
  text: string;
  warnings: string[];
};

type Props = { projectId: string; context: EmailContext; defaultTestEmail: string };

export function EmailStep({ projectId, context, defaultTestEmail }: Props) {
  const router = useRouter();
  const lastFocus = useRef<"subject" | "body">("body");

  const [subject, setSubject] = useState(context.subject);
  const [body, setBody] = useState(context.body);
  const [savedJson, setSavedJson] = useState(
    context.saved ? JSON.stringify({ subject: context.subject, body: context.body }) : ""
  );
  const [participantId, setParticipantId] = useState(context.participants[0]?.id ?? "");
  const [testTo, setTestTo] = useState(defaultTestEmail);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const dirty = JSON.stringify({ subject, body }) !== savedJson;
  const placeholders = useMemo(
    () => [...context.columns, ...RESERVED_PLACEHOLDERS],
    [context.columns]
  );

  const participant = context.participants.find((p) => p.id === participantId) ?? null;

  const vars = useMemo(
    () =>
      buildVariables(participant?.values ?? {}, {
        eventName: context.eventName,
        projectName: context.projectName,
      }),
    [participant, context.eventName, context.projectName]
  );

  const unknown = useMemo(
    () => [
      ...new Set([
        ...findUnknownPlaceholders(subject, placeholders),
        ...findUnknownPlaceholders(body, placeholders),
      ]),
    ],
    [subject, body, placeholders]
  );

  const previewSubject = renderSubject(subject, vars);
  const previewBody = renderTemplate(body, vars);

  // How many participants have no value for each column the email uses.
  const emptyWarnings = useMemo(() => {
    const used = new Set<string>();
    for (const text of [subject, body]) {
      for (const col of context.columns) {
        const token = new RegExp(
          "\\{\\{\\s*" + col.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "\\s*\\}\\}",
          "i"
        );
        if (token.test(text)) used.add(col);
      }
    }
    return [...used]
      .map((col) => ({
        col,
        count: context.participants.filter((p) => !(p.values[col] ?? "").trim()).length,
      }))
      .filter((w) => w.count > 0);
  }, [subject, body, context.columns, context.participants]);

  const contentValid = subject.trim() !== "" && body.trim() !== "" && unknown.length === 0;

  function insertPlaceholder(name: string) {
    const token = `{{${name}}}`;
    const isSubject = lastFocus.current === "subject";
    const el = document.getElementById(
      isSubject ? "email-subject" : "email-body"
    ) as HTMLInputElement | HTMLTextAreaElement | null;

    const value = isSubject ? subject : body;
    const max = isSubject ? MAX_SUBJECT_LENGTH : MAX_BODY_LENGTH;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);

    if (next.length > max) {
      setSaveError(`The ${isSubject ? "subject" : "body"} is too long to add this placeholder.`);
      return;
    }

    setSaveError("");
    setSaveMessage("");
    if (isSubject) setSubject(next);
    else setBody(next);

    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const res = await fetch(`/api/projects/${projectId}/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSaveError(data.error ?? "Could not save the email.");
        return;
      }
      setSavedJson(JSON.stringify({ subject: subject.trim(), body: body.trim() }));
      setSubject((s) => s.trim());
      setBody((b) => b.trim());
      setSaveMessage("Email saved.");
      router.refresh();
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, participantId, to: testTo }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setTestResult({
          ok: false,
          text: data.error ?? "Could not send the test email.",
          warnings: [],
        });
        return;
      }
      setTestResult({
        ok: true,
        text: data.attachment
          ? `Test email sent to ${testTo} with a sample certificate attached.`
          : `Test email sent to ${testTo} without an attachment.`,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      });
    } catch {
      setTestResult({ ok: false, text: "Network error. Please try again.", warnings: [] });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          {context.smtp ? (
            <p className="text-sm text-gray-700">
              Sending as{" "}
              <span className="font-medium">
                {context.smtp.senderName} &lt;{context.smtp.username}&gt;
              </span>{" "}
              via {context.smtp.host}:{context.smtp.port}
            </p>
          ) : (
            <p className="text-sm text-amber-800">
              SMTP is not set up yet. Add your email account to send test
              emails and certificates.
            </p>
          )}
          <Link
            href={`/settings/smtp?project=${projectId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {context.smtp ? "Change SMTP settings" : "Set up SMTP"}
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Email Content</CardTitle>
            <CardDescription>
              Each participant receives their own email with their certificate
              attached. Use placeholders to personalize it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                maxLength={MAX_SUBJECT_LENGTH}
                onFocus={() => (lastFocus.current = "subject")}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setSaveMessage("");
                }}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email-body">Body</Label>
              <Textarea
                id="email-body"
                value={body}
                rows={11}
                maxLength={MAX_BODY_LENGTH}
                onFocus={() => (lastFocus.current = "body")}
                onChange={(e) => {
                  setBody(e.target.value);
                  setSaveMessage("");
                }}
              />
              <p className="text-xs text-gray-500">
                {body.length} / {MAX_BODY_LENGTH} characters. Plain text.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Placeholders</p>
              <p className="text-xs text-gray-500">
                Click one to insert it where your cursor is (subject or body).
              </p>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertPlaceholder(name)}
                    className="rounded-full border bg-white px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    {`{{${name}}}`}
                  </button>
                ))}
              </div>
            </div>

            {unknown.length > 0 && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                Unknown placeholders: {unknown.map((n) => `{{${n}}}`).join(", ")}.
                They would appear as written in the emails. Remove them or use
                the list above.
              </p>
            )}

            {emptyWarnings.length > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                {emptyWarnings
                  .map((w) => `${w.count} participant(s) have no value for ${w.col}`)
                  .join(". ")}
                . Those parts will be blank in their emails.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>
                Shows how the email looks for the selected participant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email-participant">Participant</Label>
                <select
                  id="email-participant"
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

              <div className="rounded-lg border bg-white">
                <div className="space-y-1 border-b bg-gray-50 p-3 text-xs text-gray-600">
                  <p>
                    <span className="font-medium text-gray-900">From:</span>{" "}
                    {context.smtp
                      ? `${context.smtp.senderName} <${context.smtp.username}>`
                      : "Not set up"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">To:</span>{" "}
                    {participant?.email}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Subject:</span>{" "}
                    {previewSubject.text}
                  </p>
                </div>
                <div className="whitespace-pre-wrap break-words p-4 text-sm text-gray-900">
                  {previewBody.text}
                </div>
                <div className="border-t p-3 text-xs text-gray-500">
                  Attachment: certificate PDF for {participant?.name}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send a Test Email</CardTitle>
              <CardDescription>
                Uses your saved SMTP settings and the content on this page. A
                sample certificate is attached when your field mapping is saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="test-to">Send to</Label>
                <Input
                  id="test-to"
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={testing || !context.smtp || !contentValid || !testTo.trim()}
                onClick={handleTest}
              >
                <Send className="mr-2 h-4 w-4" />
                {testing ? "Sending..." : "Send test email"}
              </Button>

              {!context.smtp && (
                <p className="text-xs text-gray-500">Set up SMTP first.</p>
              )}

              {testResult && (
                <div
                  role="status"
                  className={
                    testResult.ok ? "space-y-1 text-sm text-green-700" : "text-sm text-red-600"
                  }
                >
                  <p>{testResult.text}</p>
                  {testResult.warnings.map((w) => (
                    <p key={w} className="text-xs text-amber-700">
                      {w}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/projects/${projectId}?step=4`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back
        </Link>

        <div className="flex items-center gap-3">
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {!saveError && saveMessage && !dirty && (
            <p className="text-sm text-green-700">
              {saveMessage} The review and send step will be available in the next update.
            </p>
          )}
          {!saveError && dirty && (
            <p className="text-sm text-amber-700">
              {context.saved ? "Unsaved changes" : "Not saved yet"}
            </p>
          )}
          <Button onClick={handleSave} disabled={!dirty || !contentValid || saving}>
            {saving ? "Saving..." : "Save Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}