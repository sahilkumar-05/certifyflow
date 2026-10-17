import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { fieldMappingSchema } from "@/lib/validation/mapping";
import {
  MappingValidationError,
  saveMapping,
} from "@/services/mapping.service";

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
    const parsed = fieldMappingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid field settings." },
        { status: 400 }
      );
    }

    const saved = await saveMapping(userId, id, parsed.data);
    if (!saved) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof MappingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}