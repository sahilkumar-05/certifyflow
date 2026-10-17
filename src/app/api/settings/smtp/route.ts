import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { smtpSchema } from "@/lib/validation/smtp";
import {
  SmtpValidationError,
  deleteSmtp,
  saveSmtp,
} from "@/services/smtp.service";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function PUT(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    await saveSmtp(userId, parsed.data);
    // The password is never part of a response.
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SmtpValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteSmtp(userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}