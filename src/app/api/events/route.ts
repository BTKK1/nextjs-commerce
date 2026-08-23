import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnalyticsEvent, trackAnalyticsEvent } from "@/lib/analytics/events";
import { resolveDataBackend } from "@/lib/backend/mode";
import { loadSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { persistAnalyticsEventToSupabase } from "@/lib/storage/supabase-store";
import type { AnalyticsEventType } from "@/lib/types";
import { WIDGET_MERCHANT_KEY_PATTERN } from "@/lib/widget/identity";

export const dynamic = "force-dynamic";

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
  try {
    const payload = schema.parse(await request.json());
    const knowledge = await loadSellerKnowledgeForProduct(payload.productSlug, payload.merchantKey);
    if (!knowledge) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
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
    return NextResponse.json({ ok: true, eventId: event.id });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid event request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Event tracking is temporarily unavailable" }, { status: 503 });
  }
}
