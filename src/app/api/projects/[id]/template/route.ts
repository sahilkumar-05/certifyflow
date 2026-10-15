import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB } from "@/lib/constants";
import { PdfValidationError } from "@/lib/pdf/inspect";
import { pageSchema } from "@/lib/validation/template";
import {
  changeTemplatePage,
  saveTemplate,
} from "@/services/template.service";

type Ctx = { params: Promise<{ id: string }> };

function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 150);
  return cleaned || "template.pdf";
}

export async function POST(req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Quick reject before reading a huge body.
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PDF_SIZE_BYTES + 100_000) {
    return NextResponse.json(
      { error: `PDF must be ${MAX_PDF_SIZE_MB} MB or smaller.` },
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
    if (file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        { error: `PDF must be ${MAX_PDF_SIZE_MB} MB or smaller.` },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await saveTemplate(
      userId,
      id,
      cleanFileName(file.name),
      bytes
    );

    if (!result) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof PdfValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const parsed = pageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid page number." }, { status: 400 });
    }

    const result = await changeTemplatePage(userId, id, parsed.data.pageNumber);
    if (!result) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PdfValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}