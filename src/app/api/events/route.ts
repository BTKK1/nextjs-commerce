import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnalyticsEvent, trackAnalyticsEvent } from "@/lib/analytics/events";
import { resolveDataBackend } from "@/lib/backend/mode";
import { loadSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { persistAnalyticsEventToSupabase } from "@/lib/storage/supabase-store";
import type { AnalyticsEventType } from "@/lib/types";
import { WIDGET_MERCHANT_KEY_PATTERN } from "@/lib/widget/identity";

export const dynamic = "force-dynamic";

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return {};
    return {
      "Access-Control-Allow-Origin": parsed.origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  } catch {
    return {};
  }
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

const visitorRefSchema = z.string().regex(/^anon-[a-zA-Z0-9-]{4,64}$/, "visitorRef must be an anonymous visitor reference");

const schema = z.object({
  merchantKey: z.string().regex(WIDGET_MERCHANT_KEY_PATTERN).optional(),
  type: z.enum([
    "widget_impression",
    "chat_opened",
    "conversation_started",
    "message_sent",
    "agent_answered",
    "fallback_triggered",
    "objection_detected",
    "repeated_question_detected",
    "product_page_view",
    "demo_add_to_cart_clicked"
  ]),
  productSlug: z.string().min(1),
  visitorRef: visitorRefSchema,
  locale: z.enum(["en", "ar"]).optional()
});

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  try {
    const payload = schema.parse(await request.json());
    const knowledge = await loadSellerKnowledgeForProduct(payload.productSlug, payload.merchantKey);
    if (!knowledge) {
      return NextResponse.json({ error: "Product not found" }, { status: 404, headers });
    }
    const product = knowledge.currentProduct;
    const eventInput = {
      type: payload.type as AnalyticsEventType,
      product,
      visitorRef: payload.visitorRef,
      storefrontLocale: payload.locale,
      merchantId: knowledge.merchant.id,
    };
    const event = resolveDataBackend() === "local"
      ? trackAnalyticsEvent(eventInput)
      : createAnalyticsEvent(eventInput);
    const persisted = await persistAnalyticsEventToSupabase(event, { merchantId: knowledge.merchant.id, merchantName: knowledge.merchant.name, merchantPublicKey: knowledge.merchant.publicKey, provider: knowledge.provider, product });
    if (resolveDataBackend() === "supabase" && (!persisted.enabled || !persisted.ok)) {
      throw new Error("Supabase analytics persistence failed.");
    }
    return NextResponse.json({ ok: true, eventId: event.id }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid event request" }, { status: 400, headers });
    }
    return NextResponse.json({ error: "Event tracking is temporarily unavailable" }, { status: 503, headers });
  }
}
