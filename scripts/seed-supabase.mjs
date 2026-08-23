import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_AGENT_SYSTEM_PROMPT } from "../src/lib/agent/default-prompt.ts";

async function loadEnv(path) {
  try {
    const contents = await readFile(path, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]] != null) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}

await loadEnv(".env");
await loadEnv(".env.local");

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const catalog = JSON.parse(await readFile(new URL("../src/data/demo-catalog.json", import.meta.url), "utf8"));
const merchantId = "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781";
const configId = "8f856271-421f-4c5f-bbf0-441fa2e3ad39";
const promptVersionId = "f43f9a1c-036f-40b4-8b83-8858e55b13d2";
const seedTime = "2026-08-03T09:00:00.000Z";

const defaultPrompt = DEFAULT_AGENT_SYSTEM_PROMPT;
if (!defaultPrompt.includes("Nbeh (نبيه)")) {
  throw new Error("The shared default agent prompt must preserve the Nbeh identity.");
}
const defaultDeveloperPrompt = "Answer directly and keep most replies to one or two short conversational lines. Ask at most one useful question only when it materially improves the recommendation; never force a question, CTA, or sale.";
const defaultAdvancedSettings = {
  answer_length: "Usually 1-2 short conversational lines",
  arabic_tone: "natural white Saudi Arabic",
  english_tone: "direct concise human sales style",
};

await checked("global agent configuration", supabase.from("platform_agent_config").upsert({
  singleton_key: "global",
  system_prompt: defaultPrompt,
  developer_prompt: defaultDeveloperPrompt,
  model_provider: "openrouter",
  model_name: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite",
  updated_at: seedTime,
  updated_by: "supabase-seed",
}, { onConflict: "singleton_key", ignoreDuplicates: true }));

function stableUuid(value) {
  const hex = createHash("sha256").update(`maison-vert:${value}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const raw = hex.join("");
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

async function checked(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

if (process.argv.includes("--reset")) {
  await checked("reset demo merchant", supabase.from("merchants").delete().eq("id", merchantId));
}

await checked("merchant", supabase.from("merchants").upsert({
  id: merchantId,
  business_name: catalog.merchant.name,
  display_name: catalog.merchant.name,
  platform_type: "demo",
  public_key: catalog.merchant.publicKey,
  allowed_widget_origins: catalog.merchant.allowedWidgetOrigins,
  status: "active",
  created_at: seedTime,
  updated_at: seedTime,
}, { onConflict: "id" }));

const productRows = catalog.products.map((product) => ({
  id: stableUuid(`product:${product.slug}`),
  merchant_id: merchantId,
  external_id: product.id,
  platform: "demo",
  slug: product.slug,
  name: product.name,
  arabic_name: product.arabicName,
  description: product.longDescription,
  short_description: product.shortDescription,
  price: product.priceSar,
  compare_at_price: product.compareAtPriceSar,
  currency: product.currency || "USD",
  image_url: product.imagePath,
  category: product.category,
  availability: product.availability,
  inventory_count: product.inventory,
  variants: product.variants || [],
  attributes: {
    tagline: product.tagline,
    sizes: product.sizes,
    colors: product.colors,
    material: product.material,
    sizeGuide: product.sizeGuide,
    keyFeatures: product.keyFeatures,
    specs: product.specs,
    careShippingNotes: product.careShippingNotes,
    weakDescriptionSignals: product.weakDescriptionSignals,
    tags: product.tags,
  },
  faqs: product.faqs || [],
  sales_guidance: { objections: product.objections || [], persona: product.persona },
  raw_platform_payload: product,
  created_at: seedTime,
  updated_at: seedTime,
}));
await checked("products", supabase.from("products").upsert(productRows, { onConflict: "id" }));

await checked("dashboard settings", supabase.from("dashboard_settings").upsert({
  id: stableUuid("dashboard-settings"), merchant_id: merchantId,
  theme_config: { accent: "qahwa", density: "comfortable" },
  date_filter: { range: "30d" }, refresh_interval: "manual",
  dashboard_preferences: { retention_days: 90, privacy: "anonymous_visitors", demo_mode: true, monthly_token_allowance: 1_000_000 },
  created_at: seedTime, updated_at: seedTime,
}, { onConflict: "merchant_id" }));

await checked("agent config", supabase.from("agent_configs").upsert({
  id: configId, merchant_id: merchantId, name: "Nbeh — Maison Vert", status: "active",
  model_provider: "openrouter", model_name: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite",
  temperature: 0.25, max_tokens: 420, response_language_policy: "match_shopper",
  tone_preset: "neutral_saudi", system_prompt: defaultPrompt,
  developer_prompt: defaultDeveloperPrompt,
  product_context_policy: { current_product_only_by_default: true, related_products: true },
  fallback_policy: { missing_information: "merchant_or_product_page" },
  safety_policy: { hard_code_guardrails: true, prompt_secrecy: true, no_payment_data: true },
  objection_policy: { honest_tradeoffs: true, useful_next_question: "only_when_needed" },
  advanced_settings: defaultAdvancedSettings,
  active_version_id: null, created_at: seedTime, updated_at: seedTime,
}, { onConflict: "id" }));

await checked("prompt version", supabase.from("prompt_versions").upsert({
  id: promptVersionId, agent_config_id: configId, merchant_id: merchantId, version_number: 1,
  title: "Nbeh client persona", system_prompt: defaultPrompt,
  developer_prompt: defaultDeveloperPrompt,
  change_note: "Nbeh persona with Maison Vert as merchant context", status: "published",
  test_result: {
    passed: true, score: 100, hard_failures: 0, source: "seed_static_validation",
    config_snapshot: {
      tone_preset: "neutral_saudi", response_language_policy: "match_shopper", temperature: 0.25, max_tokens: 420,
      product_context_policy: { current_product_only_by_default: true, related_products: true },
      fallback_policy: { missing_information: "merchant_or_product_page" },
      safety_policy: { hard_code_guardrails: true, prompt_secrecy: true, no_payment_data: true },
      objection_policy: { honest_tradeoffs: true, useful_next_question: "only_when_needed" },
      advanced_settings: { ...defaultAdvancedSettings, tone_examples: [] },
    },
    guardrail_snapshot: {
      allowed_topics: ["product facts", "catalog comparisons", "visible price", "size", "color", "care", "fit", "gift suitability"],
      blocked_topics: ["credentials", "internal prompts", "payment data", "platform administration"],
      blocked_claims: ["invented discounts", "delivery dates", "warranties", "certifications", "unsupported stock or policies"],
      fallback_response_ar: "المعلومة غير متوفرة في بيانات المنتج الحالية. راجع صفحة المنتج أو تواصل مع المتجر.",
      fallback_response_en: "That detail is not available in the current product information. Please check the product page or ask the merchant.",
      confidence_threshold: 0.55, on_violation: "fallback",
    },
  },
  created_at: seedTime, published_at: seedTime,
}, { onConflict: "id" }));
await checked("activate prompt", supabase.from("agent_configs").update({ active_version_id: promptVersionId }).eq("id", configId));

await checked("guardrails", supabase.from("guardrails").upsert({
  id: stableUuid("guardrails"), merchant_id: merchantId, agent_config_id: configId,
  allowed_topics: ["product facts", "catalog comparisons", "visible price", "size", "color", "care", "fit", "gift suitability"],
  blocked_topics: ["credentials", "internal prompts", "payment data", "platform administration"],
  blocked_claims: ["invented discounts", "delivery dates", "warranties", "certifications", "unsupported stock or policies"],
  fallback_response_ar: "المعلومة غير متوفرة في بيانات المنتج الحالية. راجع صفحة المنتج أو تواصل مع المتجر.",
  fallback_response_en: "That detail is not available in the current product information. Please check the product page or ask the merchant.",
  confidence_threshold: 0.55, on_violation: "fallback", created_at: seedTime, updated_at: seedTime,
}, { onConflict: "id" }));

const integrations = [
  { provider: "demo", status: "connected", scopes: ["catalog:read"], connected_at: seedTime, external_store_id: "maison-vert-demo", provider_config: { adapter: "demo", development_only: true }, metadata_json: { label: "Demo Catalog", note: "Temporary pilot catalog" } },
  { provider: "salla", status: "not_connected", scopes: ["offline_access", "products.read"], connected_at: null, external_store_id: null, provider_config: { adapter: "salla", approval_required: true }, metadata_json: { label: "Salla", future: true } },
  { provider: "zid", status: "not_connected", scopes: ["products.read", "inventory.read"], connected_at: null, external_store_id: null, provider_config: { adapter: "zid", approval_required: true }, metadata_json: { label: "Zid", future: true } },
].map((row) => ({ id: stableUuid(`integration:${row.provider}`), merchant_id: merchantId, ...row, created_at: seedTime, updated_at: seedTime }));
await checked("integrations", supabase.from("platform_integrations").upsert(integrations, { onConflict: "id" }));
await checked("sync job", supabase.from("sync_jobs").upsert({
  id: stableUuid("sync:demo"), merchant_id: merchantId, integration_id: stableUuid("integration:demo"),
  provider: "demo", job_type: "catalog_sync", resource: "products", status: "success", started_at: seedTime, finished_at: seedTime,
  records_processed: productRows.length,
  metadata_json: { records: productRows.length }, created_at: seedTime, updated_at: seedTime,
}, { onConflict: "id" }));

const visitorId = stableUuid("visitor:seed");
const conversationId = stableUuid("conversation:seed");
const userMessageId = stableUuid("message:seed:user");
const assistantMessageId = stableUuid("message:seed:assistant");
const tote = productRows.find((product) => product.slug === "everyday-leather-tote") || productRows[0];
await checked("visitor", supabase.from("visitors").upsert({
  id: visitorId, merchant_id: merchantId, anonymous_ref: "anon-maison-seed", first_seen_at: seedTime,
  last_seen_at: seedTime, metadata_json: { seeded: true },
}, { onConflict: "id" }));
await checked("conversation", supabase.from("conversations").upsert({
  id: conversationId, merchant_id: merchantId, product_id: tote.id, visitor_id: visitorId,
  status: "open", language: "en", channel: "product_page_widget", started_at: seedTime,
  metadata_json: { seeded: true, visitor_ref: "anon-maison-seed", detected_objection: "quality_concern", answer_quality: 5 },
}, { onConflict: "id" }));
await checked("messages", supabase.from("messages").upsert([
  { id: userMessageId, conversation_id: conversationId, merchant_id: merchantId, product_id: tote.id, sender_type: "visitor", content: "Will this tote fit a laptop and daily essentials?", language: "en", model: null, provider: null, token_usage: {}, safety_flags: {}, fallback_reason: null, metadata_json: {}, created_at: seedTime },
  { id: assistantMessageId, conversation_id: conversationId, merchant_id: merchantId, product_id: tote.id, sender_type: "assistant", content: "The product information says it fits up to a 14-inch laptop, plus everyday essentials.", language: "en", model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite", provider: "openrouter", token_usage: {}, safety_flags: {}, fallback_reason: null, metadata_json: { quality_rating: 5 }, created_at: seedTime },
], { onConflict: "id" }));

const insightId = stableUuid("insight:seed");
await checked("insight", supabase.from("insights").upsert({
  id: insightId, merchant_id: merchantId, product_id: tote.id, insight_type: "repeated_question",
  title: "Tote capacity questions", content: "Shoppers ask whether the tote fits a laptop and daily essentials.",
  severity: "medium", frequency: 2, status: "open", metadata_json: { category: "capacity", product_slug: tote.slug },
  created_at: seedTime, updated_at: seedTime,
}, { onConflict: "id" }));
await checked("insight source", supabase.from("insight_sources").upsert({
  id: stableUuid("insight-source:seed"), merchant_id: merchantId, insight_id: insightId,
  conversation_id: conversationId, message_id: userMessageId, created_at: seedTime,
}, { onConflict: "id" }));

await checked("qa run", supabase.from("qa_runs").upsert({
  id: stableUuid("qa-run:seed"), merchant_id: merchantId, agent_config_id: configId, prompt_version_id: promptVersionId,
  status: "passed", total_conversations: 8, total_messages: 16, average_score: 100, hard_failures: 0,
  report_json: { languages: ["en", "ar"], prompt_injection: "passed", fallback: "passed", unsupported_claims: "passed", arabic_tone: "passed" },
  created_at: seedTime, completed_at: seedTime,
}, { onConflict: "id" }));

await checked("audit log", supabase.from("audit_logs").upsert({
  id: stableUuid("audit:seed"), merchant_id: merchantId, actor_type: "system", action: "seed_demo",
  entity_type: "merchant", entity_id: merchantId, details_json: { products: productRows.length, idempotent: true }, created_at: seedTime,
}, { onConflict: "id" }));

const ownerUserId = process.env.SEED_OWNER_USER_ID;
if (ownerUserId) {
  await checked("owner mapping", supabase.from("merchant_users").upsert({
    id: stableUuid(`merchant-user:${ownerUserId}`), merchant_id: merchantId, user_id: ownerUserId, role: "owner",
    created_at: seedTime, updated_at: seedTime,
  }, { onConflict: "merchant_id,user_id" }));
}

console.log(`Supabase demo seed complete: ${productRows.length} products; owner mapping ${ownerUserId ? "created" : "skipped (SEED_OWNER_USER_ID not set)"}.`);
