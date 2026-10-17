import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { duplicateOwnedProject } from "@/services/project.service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const copy = await duplicateOwnedProject(id, userId);

    if (!copy) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ id: copy.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not duplicate the project. Please try again." },
      { status: 500 }
    );
  }
}