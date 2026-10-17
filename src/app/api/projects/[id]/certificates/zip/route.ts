import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { storage } from "@/lib/storage";
import { zipStream } from "@/lib/zip";
import { listDownloadableCertificates } from "@/services/download.service";

export const maxDuration = 60;

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
    const data = await listDownloadableCertificates(userId, id);

    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (data.items.length === 0) {
      return NextResponse.json(
        { error: "No certificates to download." },
        { status: 404 }
      );
    }

    // Files are read one at a time while the ZIP is streamed to the browser.
    const sources = data.items.map((item) => ({
      name: item.fileName,
      load: async () => {
        try {
          return await storage.read(item.filePath);
        } catch {
          return null;
        }
      },
    }));

    return new Response(zipStream(sources), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${data.zipName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not create the ZIP file." },
      { status: 500 }
    );
  }
}