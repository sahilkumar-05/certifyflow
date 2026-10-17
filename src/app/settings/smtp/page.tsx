import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getSmtpPublic } from "@/services/smtp.service";
import { SmtpForm } from "@/components/email/smtp-form";

export default async function SmtpSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const smtp = await getSmtpPublic(userId);

  // Optional link back to the project the user came from.
  const sp = await searchParams;
  const raw = Array.isArray(sp.project) ? sp.project[0] : sp.project;
  const projectId = raw && /^[a-z0-9]{10,40}$/i.test(raw) ? raw : null;

  return (
    <SmtpForm
      initial={smtp}
      backHref={projectId ? `/projects/${projectId}?step=5` : "/dashboard"}
      backLabel={projectId ? "Back to project" : "Back to dashboard"}
    />
  );
}