import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import {
  MAX_SPREADSHEET_SIZE_BYTES,
  MAX_SPREADSHEET_SIZE_MB,
} from "@/lib/constants";
import { cleanFileName } from "@/lib/files";
import { SpreadsheetValidationError } from "@/lib/excel/types";
import { getSheetInfo, saveSpreadsheet } from "@/services/participant.service";

type Ctx = { params: Promise<{ id: string }> };

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function POST(req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Quick reject before reading a huge body.
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SPREADSHEET_SIZE_BYTES + 100_000) {
    return NextResponse.json(
      { error: `File must be ${MAX_SPREADSHEET_SIZE_MB} MB or smaller.` },
      { status: 413 }
    );
  }

  try {
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The file is empty." }, { status: 400 });
    }
    if (file.size > MAX_SPREADSHEET_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File must be ${MAX_SPREADSHEET_SIZE_MB} MB or smaller.` },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = await saveSpreadsheet(
      userId,
      id,
      cleanFileName(file.name, "participants.xlsx"),
      bytes
    );

    if (!info) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(info, { status: 201 });
  } catch (err) {
    if (err instanceof SpreadsheetValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const sheet = new URL(req.url).searchParams.get("sheet") ?? undefined;
    if (sheet && sheet.length > 200) {
      return NextResponse.json({ error: "Invalid worksheet name." }, { status: 400 });
    }

    const info = await getSheetInfo(userId, id, sheet);
    if (!info) {
      return NextResponse.json({ error: "Spreadsheet not found" }, { status: 404 });
    }
    return NextResponse.json(info);
  } catch (err) {
    if (err instanceof SpreadsheetValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}