import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient, hasSupabaseServiceConfig } from "@/utils/supabase/server";
import { resolveDataBackend } from "@/lib/backend/mode";
import type { AgentAnswer, AgentPageContext, AnalyticsEvent, DemoProduct, PlatformProvider } from "@/lib/types";

export interface SupabaseSyncResult { enabled: boolean; ok: boolean; error?: string }
export interface SupabasePersistenceContext { merchantId: string; merchantName: string; merchantPublicKey?: string; provider: PlatformProvider; product?: DemoProduct }
export interface ProductAgentActionLogInput extends SupabasePersistenceContext { product: DemoProduct; conversationId: string; visitorRef: string; message: string; answer: AgentAnswer; fallbackReason?: string; pageContext?: AgentPageContext }

function enabled() {
  return resolveDataBackend() === "supabase" && process.env.SUPABASE_AGENT_ENABLED === "true" && hasSupabaseServiceConfig();
}

function stableUuid(value: string): string {
  const hex = createHash("sha256").update(`ai-sales-agent:${value}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const raw = hex.join("");
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function asUuid(kind: string, value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : stableUuid(`${kind}:${value}`);
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 240);
  if (error && typeof error === "object" && "message" in error) return String(error.message).slice(0, 240);
  return String(error ?? "unknown").slice(0, 240);
}

async function checked(promise: PromiseLike<{ error: unknown | null }>) {
  const { error } = await promise;
  if (error) throw error;
}

function productUuid(product: DemoProduct, merchantId: string): string {
  return asUuid(`product:${merchantId}`, product.id || product.slug);
}

function productRow(product: DemoProduct, context: SupabasePersistenceContext) {
  return {
    id: productUuid(product, context.merchantId), merchant_id: context.merchantId, external_id: product.externalId ?? product.id,
    platform: context.provider === "demo_catalog" ? "demo" : context.provider, slug: product.slug,
    name: product.name, arabic_name: product.arabicName, description: product.longDescription, short_description: product.shortDescription,
    price: product.priceSar, compare_at_price: product.compareAtPriceSar, currency: product.currency ?? "USD", image_url: product.imagePath,
    category: product.category, availability: product.availability, inventory_count: product.inventory, variants: product.variants,
    attributes: { tagline: product.tagline, sizes: product.sizes, colors: product.colors, material: product.material, sizeGuide: product.sizeGuide, keyFeatures: product.keyFeatures, specs: product.specs, careShippingNotes: product.careShippingNotes, weakDescriptionSignals: product.weakDescriptionSignals, tags: product.tags },
    faqs: product.faqs, sales_guidance: { objections: product.objections, persona: product.persona }, raw_platform_payload: product,
    updated_at: new Date().toISOString(),
  };
}

export async function logProductAgentActionToSupabase(input: ProductAgentActionLogInput): Promise<SupabaseSyncResult> {
  if (!enabled()) return { enabled: false, ok: true };
  try {
    const supabase = createServiceClient();
    await checked(supabase.from("audit_logs").insert({
      merchant_id: input.merchantId, actor_type: "agent", action: input.fallbackReason ? "agent_answer_fallback" : "agent_answer",
      entity_type: "conversation", entity_id: asUuid(`conversation:${input.merchantId}`, input.conversationId),
      details_json: { catalog_provider: input.provider, product_slug: input.product.slug, visitor_ref_hash: stableUuid(`visitor-ref:${input.merchantId}:${input.visitorRef}`), message_chars: input.message.length, answer_chars: input.answer.text.length, language: input.answer.language, provider: input.answer.provider ?? null, model: input.answer.model ?? null, prompt_version: input.answer.promptVersion ?? null, fallback_reason: input.fallbackReason ?? input.answer.fallbackReason ?? null, detected_objection: input.answer.detectedObjection ?? null, latency_ms: input.answer.latencyMs ?? null, token_usage: { prompt: input.answer.promptTokens ?? null, completion: input.answer.completionTokens ?? null, total: input.answer.totalTokens ?? null, estimated_cost_usd: input.answer.estimatedCost ?? null }, page_path: input.pageContext?.path ?? null, pii_minimized: true },
    }));
    return { enabled: true, ok: true };
  } catch (error) {
    console.error("[supabase-agent-action] write failed:", safeError(error));
    return { enabled: true, ok: false, error: safeError(error) };
  }
}

export async function persistAnalyticsEventToSupabase(event: AnalyticsEvent, context: SupabasePersistenceContext): Promise<SupabaseSyncResult> {
  if (!enabled()) return { enabled: false, ok: true };
  if (!context.product) return { enabled: true, ok: false, error: "Product context is required" };
  try {
    const supabase = createServiceClient();
    const { data: visitor, error: visitorError } = await supabase.from("visitors").upsert({
      merchant_id: context.merchantId,
      anonymous_ref: event.visitorRef,
      last_seen_at: event.createdAt,
      metadata_json: { pii_collected: false },
    }, { onConflict: "merchant_id,anonymous_ref" }).select("id").single();
    if (visitorError || !visitor) throw visitorError ?? new Error("Could not persist analytics visitor");
    await checked(supabase.from("products").upsert(productRow(context.product, context), { onConflict: "id" }));
    await checked(supabase.from("analytics_events").upsert({
      id: asUuid(`analytics:${context.merchantId}`, event.id), merchant_id: context.merchantId,
      product_id: productUuid(context.product, context.merchantId), visitor_id: visitor.id, product_slug: context.product.slug,
      visitor_ref: event.visitorRef, event_type: event.type, storefront_locale: event.storefrontLocale ?? null,
      metadata_json: { catalog_provider: context.provider, pii_minimized: true }, created_at: event.createdAt,
    }, { onConflict: "id" }));
    return { enabled: true, ok: true };
  } catch (error) {
    console.error("[supabase-analytics] write failed:", safeError(error));
    return { enabled: true, ok: false, error: safeError(error) };
  }
}
