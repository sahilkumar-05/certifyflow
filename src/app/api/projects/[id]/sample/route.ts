import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { PdfValidationError } from "@/lib/pdf/inspect";
import { generateSampleCertificate } from "@/services/certificate.service";
import { MappingValidationError } from "@/services/mapping.service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const participantId = new URL(req.url).searchParams.get("participantId") ?? "";
    if (!participantId || participantId.length > 64) {
      return NextResponse.json({ error: "Invalid participant." }, { status: 400 });
    }

    const result = await generateSampleCertificate(userId, id, participantId);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="sample-certificate.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof MappingValidationError || err instanceof PdfValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Could not generate the sample certificate." },
      { status: 500 }
    );
  }
}