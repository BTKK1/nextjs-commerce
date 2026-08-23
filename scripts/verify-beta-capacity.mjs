import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

for (const filename of [".env", ".env.local"]) {
  try {
    const text = await readFile(filename, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && process.env[match[1]] == null) {
        process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {}
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const founderMerchantId = "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781";
const merchantCount = 100;
const concurrency = 10;
if (!url || !secret) throw new Error("Supabase service credentials are required for the capacity verification.");

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = `beta-${Date.now()}-${randomBytes(4).toString("hex")}`;
const fixtures = Array.from({ length: merchantCount }, (_, index) => {
  const merchantId = randomUUID();
  const productId = randomUUID();
  const provider = index % 2 === 0 ? "salla" : "zid";
  return {
    index,
    merchantId,
    productId,
    conversationId: randomUUID(),
    provider,
    slug: `${runId}-${provider}-${index + 1}`,
    visitorRef: `anon-cap-${String(index + 1).padStart(3, "0")}`,
    language: index % 2 === 0 ? "ar" : "en",
  };
});
const merchantIds = fixtures.map((fixture) => fixture.merchantId);
let verified = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ensure(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function inBatches(items, batchSize, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(batchSize, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

async function cleanup() {
  for (let start = 0; start < merchantIds.length; start += 25) {
    const ids = merchantIds.slice(start, start + 25);
    const result = await supabase.from("merchants").delete().in("id", ids);
    if (result.error) throw new Error(`Capacity fixture cleanup failed: ${result.error.message}`);
  }
}

try {
  ensure(await supabase.from("merchants").insert(fixtures.map((fixture) => ({
    id: fixture.merchantId,
    business_name: `Nbeh Capacity Merchant ${fixture.index + 1}`,
    display_name: `Capacity ${fixture.index + 1}`,
    email: `${runId}-${fixture.index + 1}@example.invalid`,
    platform_type: fixture.provider,
    status: "active",
    public_key: `cap_${fixture.merchantId.replaceAll("-", "")}`,
    allowed_widget_origins: [`https://${runId}-${fixture.index + 1}.example.invalid`],
  }))), "merchant fixture insert");

  ensure(await supabase.from("products").insert(fixtures.map((fixture) => ({
    id: fixture.productId,
    merchant_id: fixture.merchantId,
    external_id: `capacity-product-${fixture.index + 1}`,
    platform: fixture.provider,
    slug: fixture.slug,
    name: `Capacity Product ${fixture.index + 1}`,
    arabic_name: `منتج اختبار ${fixture.index + 1}`,
    description: "Tenant-isolated Nbeh beta capacity fixture.",
    price: 199,
    currency: "SAR",
    availability: "in_stock",
    attributes: { material: "Cotton", capacity_fixture: true },
  }))), "product fixture insert");

  ensure(await supabase.from("dashboard_settings").insert(fixtures.map((fixture) => ({
    merchant_id: fixture.merchantId,
    dashboard_preferences: { monthly_token_allowance: 5000, capacity_fixture: true },
  }))), "settings fixture insert");

  await inBatches(fixtures, concurrency, async (fixture) => {
    const reserved = ensure(await supabase.rpc("reserve_agent_token_budget", {
      target_merchant_id: fixture.merchantId,
      estimated_tokens: 600,
      request_time: new Date().toISOString(),
    }), `token reserve ${fixture.index + 1}`);
    const reservation = Array.isArray(reserved) ? reserved[0] : reserved;
    assert(reservation?.allowed === true && reservation?.reservation_id, `Merchant ${fixture.index + 1} could not reserve tokens.`);

    ensure(await supabase.rpc("persist_agent_turn_atomic", {
      target_merchant_id: fixture.merchantId,
      target_product_id: fixture.productId,
      target_product_slug: fixture.slug,
      target_visitor_ref: fixture.visitorRef,
      target_conversation_id: fixture.conversationId,
      target_is_new: true,
      target_storefront_locale: fixture.language,
      target_response_language: fixture.language,
      target_welcome_message: fixture.language === "ar" ? "هلا، أنا نبيه." : "Hi, I am Nbeh.",
      target_user_message: fixture.language === "ar" ? "وش خامته؟" : "What is it made of?",
      target_normalized_question: fixture.language === "ar" ? "وش خامته" : "what is it made of",
      target_answer: {
        text: fixture.language === "ar" ? "خامة المنتج قطن." : "It is made from cotton.",
        language: fixture.language,
        model: "capacity-fixture",
        provider: "test",
        token_usage: { prompt: 120, completion: 60, total: 180, estimated_cost_usd: 0 },
        latency_ms: 50,
        safety_flags: { confidence: 1 },
        metadata: { capacity_fixture: true },
      },
      target_signals: [],
      request_time: new Date().toISOString(),
    }), `atomic turn ${fixture.index + 1}`);

    ensure(await supabase.rpc("settle_agent_token_budget", {
      target_reservation_id: reservation.reservation_id,
      actual_tokens: 180,
      request_succeeded: true,
      settlement_time: new Date().toISOString(),
    }), `token settle ${fixture.index + 1}`);
  });

  const [products, visitors, conversations, messages, analytics, usage] = await Promise.all([
    supabase.from("products").select("id,merchant_id").in("merchant_id", merchantIds),
    supabase.from("visitors").select("id,merchant_id").in("merchant_id", merchantIds),
    supabase.from("conversations").select("id,merchant_id,product_id,language").in("merchant_id", merchantIds),
    supabase.from("messages").select("id,merchant_id,product_id,language,sender_type").in("merchant_id", merchantIds),
    supabase.from("analytics_events").select("id,merchant_id,product_id,event_type").in("merchant_id", merchantIds),
    supabase.from("merchant_token_usage_monthly").select("merchant_id,consumed_tokens,reserved_tokens,request_count").in("merchant_id", merchantIds),
  ]);
  for (const [label, result] of Object.entries({ products, visitors, conversations, messages, analytics, usage })) ensure(result, `${label} verification`);

  assert(products.data.length === merchantCount, `Expected ${merchantCount} products, received ${products.data.length}.`);
  assert(visitors.data.length === merchantCount, `Expected ${merchantCount} visitors, received ${visitors.data.length}.`);
  assert(conversations.data.length === merchantCount, `Expected ${merchantCount} conversations, received ${conversations.data.length}.`);
  assert(messages.data.length === merchantCount * 3, `Expected ${merchantCount * 3} messages, received ${messages.data.length}.`);
  assert(analytics.data.length === merchantCount * 3, `Expected ${merchantCount * 3} analytics events, received ${analytics.data.length}.`);
  assert(usage.data.length === merchantCount, `Expected ${merchantCount} token ledgers, received ${usage.data.length}.`);

  const expectedProducts = new Map(fixtures.map((fixture) => [fixture.merchantId, fixture.productId]));
  for (const conversation of conversations.data) {
    assert(expectedProducts.get(conversation.merchant_id) === conversation.product_id, `Conversation crossed a merchant product boundary for ${conversation.merchant_id}.`);
  }
  for (const message of messages.data) {
    assert(expectedProducts.get(message.merchant_id) === message.product_id, `Message crossed a merchant product boundary for ${message.merchant_id}.`);
  }
  for (const event of analytics.data) {
    assert(expectedProducts.get(event.merchant_id) === event.product_id, `Analytics crossed a merchant product boundary for ${event.merchant_id}.`);
  }
  for (const ledger of usage.data) {
    assert(Number(ledger.consumed_tokens) === 180, `Unexpected token charge for ${ledger.merchant_id}.`);
    assert(Number(ledger.reserved_tokens) === 0, `Token reservation leaked for ${ledger.merchant_id}.`);
    assert(Number(ledger.request_count) === 1, `Unexpected request count for ${ledger.merchant_id}.`);
  }

  verified = true;
} finally {
  await cleanup();
}

if (verified) {
  ensure(await supabase.from("audit_logs").insert({
    merchant_id: founderMerchantId,
    actor_type: "system",
    action: "beta_capacity_verified",
    entity_type: "platform",
    details_json: {
      run_id: runId,
      merchant_count: merchantCount,
      max_concurrency: concurrency,
      provider_mix: { salla: 50, zid: 50 },
      bilingual_contexts: true,
      atomic_persistence: true,
      token_budget_isolation: true,
      temporary_data_removed: true,
    },
  }), "capacity audit evidence");
  console.log(`Beta capacity verification passed for ${merchantCount} isolated Salla/Zid merchant contexts at concurrency ${concurrency}; temporary fixtures were removed.`);
}
