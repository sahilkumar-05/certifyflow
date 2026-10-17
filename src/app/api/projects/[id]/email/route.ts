import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { emailContentSchema } from "@/lib/validation/email";
import {
  EmailValidationError,
  saveEmailContent,
} from "@/services/email.service";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = emailContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid email content." },
        { status: 400 }
      );
    }

    const saved = await saveEmailContent(userId, id, parsed.data);
    if (!saved) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof EmailValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}