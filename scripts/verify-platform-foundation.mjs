import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

for (const filename of [".env", ".env.local"]) {
  try {
    const text = await readFile(filename, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase server credentials are required.");
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const merchantId = "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781";

const [merchant, products, integrations, syncJobs, webhooks, oauthStates, configs, globalConfig, analytics, visitors, conversations, messages, rateBuckets] = await Promise.all([
  supabase.from("merchants").select("id,public_key,allowed_widget_origins,platform_type").eq("id", merchantId).maybeSingle(),
  supabase.from("products").select("id,slug,platform").eq("merchant_id", merchantId),
  supabase.from("platform_integrations").select("provider,status,external_store_id,provider_config").eq("merchant_id", merchantId),
  supabase.from("sync_jobs").select("provider,job_type,records_processed,status").eq("merchant_id", merchantId),
  supabase.from("webhook_events").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
  supabase.from("oauth_states").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
  supabase.from("agent_configs").select("id,active_version_id").eq("merchant_id", merchantId).eq("status", "active"),
  supabase.from("platform_agent_config").select("singleton_key,model_provider,model_name,updated_at").eq("singleton_key", "global").maybeSingle(),
  supabase.from("analytics_events").select("id,product_slug,visitor_ref,storefront_locale").eq("merchant_id", merchantId).limit(1),
  supabase.from("visitors").select("id,anonymous_ref").eq("merchant_id", merchantId).limit(1),
  supabase.from("conversations").select("id,visitor_id,metadata_json").eq("merchant_id", merchantId).limit(1),
  supabase.from("messages").select("id,sender_type,created_at").eq("merchant_id", merchantId).limit(1),
  supabase.from("request_rate_limit_buckets").select("merchant_id,bucket_scope,fingerprint_hash,request_count", { count: "exact", head: true }).eq("merchant_id", merchantId),
]);

for (const [label, result] of Object.entries({ merchant, products, integrations, syncJobs, webhooks, oauthStates, configs, globalConfig, analytics, visitors, conversations, messages, rateBuckets })) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
}
if (!merchant.data?.public_key) throw new Error("Pilot merchant public widget identity is missing.");
if (!Array.isArray(merchant.data.allowed_widget_origins)) throw new Error("Widget origin allowlist is missing.");
if ((products.data ?? []).length < 8 || new Set((products.data ?? []).map((row) => row.slug)).size !== (products.data ?? []).length) throw new Error("Normalized pilot catalog is incomplete or has duplicate slugs.");
const integrationProviders = new Set((integrations.data ?? []).map((row) => row.provider));
if (!["demo", "salla", "zid"].every((provider) => integrationProviders.has(provider))) throw new Error("Provider integration records are incomplete.");
const connectedExternalStores = (integrations.data ?? []).filter((row) => row.status === "connected" && row.provider !== "demo");
if (connectedExternalStores.some((row) => !row.external_store_id)) throw new Error("A connected commerce provider is missing its signed-webhook store identity.");
if (new Set(connectedExternalStores.map((row) => `${row.provider}:${row.external_store_id}`)).size !== connectedExternalStores.length) throw new Error("Commerce provider store identities are not unique.");
if (!(syncJobs.data ?? []).some((row) => row.provider === "demo" && row.job_type === "catalog_sync")) throw new Error("Provider-aware demo sync evidence is missing.");
if ((configs.data ?? []).length !== 1 || !configs.data[0].active_version_id) throw new Error("Active merchant agent configuration is missing.");
if (!globalConfig.data?.model_name) throw new Error("Global Nbeh agent configuration is missing.");

console.log(`Platform foundation verified: ${(products.data ?? []).length} products, ${(integrations.data ?? []).length} providers, ${(syncJobs.data ?? []).length} sync jobs, runtime persistence/rate-limit columns, webhook/OAuth tables reachable.`);
