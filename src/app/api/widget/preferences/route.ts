import { NextResponse } from "next/server";
import { z } from "zod";
import { loadWidgetPreferences } from "@/lib/widget/preferences";
import { WIDGET_MERCHANT_KEY_PATTERN } from "@/lib/widget/identity";

export const dynamic = "force-dynamic";

const querySchema = z.object({ merchantKey: z.string().regex(WIDGET_MERCHANT_KEY_PATTERN) });

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  try {
    const parsed = new URL(origin);
    if (!/^https?:$/.test(parsed.protocol)) return {};
    return { "Access-Control-Allow-Origin": parsed.origin, Vary: "Origin" };
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const headers = corsHeaders(request);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ merchantKey: url.searchParams.get("merchantKey") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid widget preferences request" }, { status: 400, headers });
  try {
    const preferences = await loadWidgetPreferences(parsed.data.merchantKey);
    if (!preferences) return NextResponse.json({ error: "Merchant not found" }, { status: 404, headers });
    return NextResponse.json(preferences, { headers: { ...headers, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Widget preferences are temporarily unavailable" }, { status: 503, headers });
  }
}
