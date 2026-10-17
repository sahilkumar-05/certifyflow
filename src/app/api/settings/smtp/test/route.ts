import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { allowRequest } from "@/lib/rate-limit";
import { smtpSchema } from "@/lib/validation/smtp";
import {
  SmtpValidationError,
  testSmtpConnection,
} from "@/services/smtp.service";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowRequest(`smtp-test:${userId}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = smtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid SMTP settings." },
        { status: 400 }
      );
    }

    await testSmtpConnection(userId, parsed.data);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SmtpValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}