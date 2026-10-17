import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { PdfValidationError } from "@/lib/pdf/inspect";
import {
  CertificateError,
  generateBatch,
  resetCertificates,
} from "@/services/certificate.service";
import { MappingValidationError } from "@/services/mapping.service";

const bodySchema = z.object({ action: z.enum(["next", "retry", "reset"]) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { id } = await ctx.params;
    const { action } = parsed.data;

    const result =
      action === "reset"
        ? await resetCertificates(userId, id)
        : await generateBatch(userId, id, action === "retry");

    if (!result) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (
      err instanceof CertificateError ||
      err instanceof MappingValidationError ||
      err instanceof PdfValidationError
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}