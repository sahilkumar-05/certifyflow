"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  projectId: string;
  label?: string;
  size?: "sm" | "default";
};

// Copies the template, field mapping and email text into a new project.
export function DuplicateButton({ projectId, label = "Duplicate", size = "sm" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Could not duplicate the project.");
        return;
      }
      // Template, mapping and email are already set, so the next job is the spreadsheet.
      router.push(`/projects/${data.id}?step=3`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={busy}
        onClick={handleClick}
      >
        <Copy className="mr-1 h-4 w-4" />
        {busy ? "Duplicating..." : label}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}