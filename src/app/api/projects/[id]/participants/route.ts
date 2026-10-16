import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { SpreadsheetValidationError } from "@/lib/excel/types";
import { mappingSchema } from "@/lib/validation/spreadsheet";
import { saveParticipants } from "@/services/participant.service";

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
    const parsed = mappingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid column selection." }, { status: 400 });
    }

    const summary = await saveParticipants(userId, id, parsed.data);
    if (!summary) {
      return NextResponse.json({ error: "Spreadsheet not found" }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof SpreadsheetValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}