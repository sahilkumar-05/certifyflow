import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { readTemplateFile } from "@/services/template.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const file = await readTemplateFile(userId, id);

    if (!file) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
}