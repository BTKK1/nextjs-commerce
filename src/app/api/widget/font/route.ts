import { NextResponse } from "next/server";

const OUTFIT_LATIN_VARIABLE_FONT =
  "https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtq.woff2";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(OUTFIT_LATIN_VARIABLE_FONT, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "widget_font_unavailable" }, { status: 503 });
  }

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=2592000, stale-while-revalidate=86400",
      "content-type": "font/woff2",
      "cross-origin-resource-policy": "cross-origin",
      "x-content-type-options": "nosniff",
    },
  });
}
