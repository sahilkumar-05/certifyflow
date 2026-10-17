"use client";
import { DuplicateButton } from "@/components/projects/duplicate-button";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ProjectRow = {
  id: string;
  name: string;
  eventName: string;
  status: "DRAFT" | "READY" | "PROCESSING" | "COMPLETED";
  createdAt: string;
};

const STATUS_STYLES: Record<ProjectRow["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  READY: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<ProjectRow["status"], string> = {
  DRAFT: "Draft",
  READY: "Ready",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ProjectsList({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<ProjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${target.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete project");
        return;
      }
      setTarget(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
        <Link href="/projects/new" className={buttonVariants()}>
          <Plus className="mr-1 h-4 w-4" />
          Create New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FolderPlus className="h-6 w-6" />
            </div>
            <h3 className="text-base font-medium text-gray-900">
              No projects yet
            </h3>
            <p className="max-w-sm text-sm text-gray-500">
              Create your first project to upload a certificate template and
              start sending certificates.
            </p>
            <Link href="/projects/new" className={buttonVariants()}>
              Create New Project
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.eventName}</TableCell>
                    <TableCell>{formatDate(p.createdAt)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[p.status]}>
                        {STATUS_LABELS[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/projects/${p.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          View
                        </Link>
                                                {p.status !== "DRAFT" && (
                          <Link
                            href={`/projects/${p.id}/results`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            Results
                          </Link>
                        )}
                        <DuplicateButton projectId={p.id} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => {
                            setError("");
                            setTarget(p);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{target?.name}&quot; along with
              its participants and certificates. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}