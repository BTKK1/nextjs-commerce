import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  let font: Buffer;
  try {
    font = await readFile(join(process.cwd(), "public", "fonts", "outfit-400.ttf"));
  } catch {
    return NextResponse.json({ error: "widget_font_unavailable" }, { status: 503 });
  }

  return new NextResponse(new Uint8Array(font).buffer, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=2592000, stale-while-revalidate=86400",
      "content-type": "font/ttf",
      "cross-origin-resource-policy": "cross-origin",
      "x-content-type-options": "nosniff",
    },
  });
}
