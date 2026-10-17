"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_SMTP_PORTS } from "@/lib/validation/smtp";
import type { SmtpPublic } from "@/types/smtp";

const selectClass =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const PORT_LABELS: Record<number, string> = {
  587: "587 - STARTTLS (recommended)",
  465: "465 - SSL/TLS",
  2525: "2525 - STARTTLS (alternative)",
  25: "25 - STARTTLS (often blocked)",
};

type Status = { type: "success" | "error"; text: string } | null;

type Props = {
  initial: SmtpPublic | null;
  backHref: string;
  backLabel: string;
};

export function SmtpForm({ initial, backHref, backLabel }: Props) {
  const router = useRouter();

  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState(String(initial?.port ?? 587));
  const [secure, setSecure] = useState(initial?.secure ?? false);
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [senderName, setSenderName] = useState(initial?.senderName ?? "");
  const [hasPassword, setHasPassword] = useState(initial !== null);

  const [busy, setBusy] = useState<"test" | "save" | "remove" | null>(null);
  const [status, setStatus] = useState<Status>(null);

  function payload() {
    return {
      smtpHost: host,
      smtpPort: Number(port),
      secure,
      smtpUsername: username,
      smtpPassword: password,
      senderName,
    };
  }

  function localError(): string {
    if (!host.trim()) return "Enter the SMTP host.";
    if (!username.trim()) return "Enter the SMTP username.";
    if (!hasPassword && !password) return "Enter the SMTP password.";
    return "";
  }

  async function send(url: string, method: string) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data.error as string | undefined) ?? "" };
  }

  async function handleTest() {
    const problem = localError();
    if (problem) {
      setStatus({ type: "error", text: problem });
      return;
    }

    setBusy("test");
    setStatus(null);
    try {
      const result = await send("/api/settings/smtp/test", "POST");
      setStatus(
        result.ok
          ? { type: "success", text: "Connection successful. The server accepted your login." }
          : { type: "error", text: result.error || "Connection test failed." }
      );
    } catch {
      setStatus({ type: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const problem = localError();
    if (problem) {
      setStatus({ type: "error", text: problem });
      return;
    }

    setBusy("save");
    setStatus(null);
    try {
      const result = await send("/api/settings/smtp", "PUT");
      if (!result.ok) {
        setStatus({ type: "error", text: result.error || "Could not save the settings." });
        return;
      }
      setPassword("");
      setHasPassword(true);
      setStatus({ type: "success", text: "SMTP settings saved. The password is stored encrypted." });
      router.refresh();
    } catch {
      setStatus({ type: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (!window.confirm("Remove the saved SMTP settings?")) return;

    setBusy("remove");
    setStatus(null);
    try {
      const res = await fetch("/api/settings/smtp", { method: "DELETE" });
      if (!res.ok) {
        setStatus({ type: "error", text: "Could not remove the settings." });
        return;
      }
      setHost("");
      setPort("587");
      setSecure(false);
      setUsername("");
      setPassword("");
      setSenderName("");
      setHasPassword(false);
      setStatus({ type: "success", text: "SMTP settings removed." });
      router.refresh();
    } catch {
      setStatus({ type: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SMTP Settings</CardTitle>
          <CardDescription>
            Certificates are sent through your own email account. Your password
            is encrypted on the server and is never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-600">
                {hasPassword ? "Settings are saved." : "No settings saved yet."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setHost("smtp.gmail.com");
                  setPort("587");
                  setSecure(false);
                }}
              >
                Use Gmail settings
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="smtp-host">SMTP host</Label>
                <Input
                  id="smtp-host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  disabled={disabled}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="smtp-port">SMTP port</Label>
                <select
                  id="smtp-port"
                  className={selectClass}
                  value={port}
                  disabled={disabled}
                  onChange={(e) => {
                    setPort(e.target.value);
                    // Port 465 uses SSL/TLS from the start. The others use STARTTLS.
                    setSecure(e.target.value === "465");
                  }}
                >
                  {ALLOWED_SMTP_PORTS.map((p) => (
                    <option key={p} value={p}>
                      {PORT_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                checked={secure}
                disabled={disabled}
                onChange={(e) => setSecure(e.target.checked)}
              />
              Use SSL/TLS from the start (needed for port 465)
            </label>

            <div className="space-y-1">
              <Label htmlFor="smtp-username">Username (your email address)</Label>
              <Input
                id="smtp-username"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@gmail.com"
                autoComplete="off"
                disabled={disabled}
              />
              <p className="text-xs text-gray-500">
                Emails are sent from this address.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="smtp-password">Password</Label>
              <Input
                id="smtp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  hasPassword ? "Saved. Leave blank to keep it." : "App password"
                }
                autoComplete="new-password"
                disabled={disabled}
              />
              {hasPassword && (
                <p className="text-xs text-gray-500">
                  If you change the host or username, enter the password again.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="smtp-sender">Sender name</Label>
              <Input
                id="smtp-sender"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Event Management Team"
                maxLength={100}
                disabled={disabled}
              />
            </div>

            {status && (
              <p
                role="status"
                className={
                  status.type === "success"
                    ? "text-sm text-green-700"
                    : "text-sm text-red-600"
                }
              >
                {status.text}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" variant="outline" disabled={disabled} onClick={handleTest}>
                {busy === "test" ? "Testing..." : "Test connection"}
              </Button>
              <Button type="submit" disabled={disabled}>
                {busy === "save" ? "Saving..." : "Save settings"}
              </Button>
              {initial && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600"
                  disabled={disabled}
                  onClick={handleRemove}
                >
                  Remove
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Using Gmail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>
            Gmail does not accept your normal password here. Turn on 2-Step
            Verification for your Google account, then create an App Password
            (myaccount.google.com/apppasswords) and paste the 16-character code
            in the password field.
          </p>
          <p>
            Use host smtp.gmail.com, port 587, and your full Gmail address as
            the username.
          </p>
          <p>
            Every provider limits how many emails you can send per day, and
            delivery is not guaranteed. Check your provider&apos;s limits
            before sending to a large list.
          </p>
        </CardContent>
      </Card>

      <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
        {backLabel}
      </Link>
    </div>
  );
}