import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { allowRequest } from "@/lib/rate-limit";
import { testEmailSchema } from "@/lib/validation/email";
import { EmailValidationError, sendTestEmail } from "@/services/email.service";
import { SmtpValidationError } from "@/services/smtp.service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowRequest(`test-email:${userId}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many test emails. Please wait a few minutes." },
      { status: 429 }
    );
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = testEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      );
    }

    const result = await sendTestEmail(userId, id, parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EmailValidationError || err instanceof SmtpValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}