import { NextResponse } from "next/server";
import { z } from "zod";
import { trackAnalyticsEvent } from "@/lib/analytics/events";
import { getSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { persistDemoSnapshotToSupabase } from "@/lib/storage/supabase-store";
import type { AnalyticsEventType } from "@/lib/types";

export const dynamic = "force-dynamic";

const visitorRefSchema = z.string().regex(/^anon-[a-zA-Z0-9-]{4,64}$/, "visitorRef must be an anonymous visitor reference");

const schema = z.object({
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
    const product = getSellerKnowledgeForProduct(payload.productSlug)?.currentProduct;
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const event = trackAnalyticsEvent({
      type: payload.type as AnalyticsEventType,
      product,
      visitorRef: payload.visitorRef,
      storefrontLocale: payload.locale
    });
    await persistDemoSnapshotToSupabase();
    return NextResponse.json({ ok: true, eventId: event.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid event request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
