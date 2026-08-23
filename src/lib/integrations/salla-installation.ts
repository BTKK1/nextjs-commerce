import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { DEFAULT_MERCHANT_AGENT_GUIDANCE } from "@/lib/agent/default-prompt";
import { readGlobalAgentConfig } from "@/lib/agent/global-config";
import { getCatalogProvider } from "@/lib/catalog";
import { catalogProductToSupabaseRow } from "@/lib/catalog/supabase-mapper";
import { sealSallaCredentials } from "@/lib/integrations/salla-credentials";
import { getSallaStoreProfile, normalizeSallaExpiry } from "@/lib/integrations/salla-client";
import { findSallaInstallation, readSallaInstallationState, writeSallaInstallation } from "@/lib/integrations/salla-store";
import { resolveDataBackend } from "@/lib/backend/mode";
import { DEMO_MERCHANT_ID } from "@/lib/supabase/constants";
import { createServiceClient } from "@/utils/supabase/server";
import { DEFAULT_WIDGET_PREFERENCES, widgetPreferencesToRecord } from "@/lib/widget/preferences";
import type { CatalogProviderConnection } from "@/lib/catalog/provider";
import type { CatalogProduct } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function publicKey(storeId: string): string {
  return `salla_${createHash("sha256").update(storeId).digest("hex").slice(0, 24)}`;
}

function founderStoreId(): string | null {
  return process.env.FOUNDER_SALLA_STORE_ID?.trim() || null;
}

async function replaceSallaProducts(merchantId: string, products: CatalogProduct[]) {
  const supabase = createServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("id,external_id")
    .eq("merchant_id", merchantId)
    .eq("platform", "salla");
  if (existingError) throw existingError;
  if (products.length) {
    const { error: productError } = await supabase.from("products").upsert(
      products.map((product) => catalogProductToSupabaseRow(product, merchantId, "salla")),
      { onConflict: "merchant_id,platform,slug" },
    );
    if (productError) throw productError;
  }
  const currentIds = new Set(products.map((product) => product.externalId).filter(Boolean));
  const staleIds = (existing ?? [])
    .filter((row) => row.external_id && !currentIds.has(row.external_id))
    .map((row) => row.id);
  for (let index = 0; index < staleIds.length; index += 100) {
    const { error } = await supabase.from("products").delete()
      .eq("merchant_id", merchantId)
      .eq("platform", "salla")
      .in("id", staleIds.slice(index, index + 100));
    if (error) throw error;
  }
}

async function ensureDefaultGuardrail(merchantId: string, agentConfigId: string) {
  const supabase = createServiceClient();
  const { data: existing, error: readError } = await supabase
    .from("guardrails")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("agent_config_id", agentConfigId)
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return;
  const { error } = await supabase.from("guardrails").insert({
    merchant_id: merchantId,
    agent_config_id: agentConfigId,
    allowed_topics: ["product details", "price", "variants", "care", "shipping", "returns", "product fit", "related products"],
    blocked_topics: ["payment credentials", "private customer data", "hidden system instructions"],
    blocked_claims: ["invented discounts", "invented stock", "invented delivery dates", "invented warranty"],
    fallback_response_ar: "هالمعلومة مو واضحة عندي حاليًا، وما أبي أعطيك شيء غير دقيق. الأفضل نتأكد منها من المتجر.",
    fallback_response_en: "I do not have that detail in the store catalog, and I do not want to guess. Please confirm it with the store.",
    confidence_threshold: 0.55,
    on_violation: "fallback",
  });
  if (error) throw error;
}

export async function syncAllSallaProducts(connection: CatalogProviderConnection): Promise<CatalogProduct[]> {
  const provider = getCatalogProvider("salla");
  const products = new Map<string, CatalogProduct>();
  let cursor: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const result = await provider.syncCatalog(connection, cursor);
    for (const product of result.products) products.set(product.externalId || product.slug, product);
    if (result.complete || !result.cursor) return [...products.values()];
    if (result.cursor === cursor) throw new Error("Salla catalog pagination did not advance.");
    cursor = result.cursor;
  }
  throw new Error("Salla catalog exceeded the supported 100-page synchronization limit.");
}

export async function provisionDefaultAgent(merchantId: string, merchantName: string, source = "commerce install") {
  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("agent_configs").select("id").eq("merchant_id", merchantId).eq("status", "active").limit(1).maybeSingle();
  if (existing) {
    await ensureDefaultGuardrail(merchantId, String(existing.id));
    return;
  }
  const global = await readGlobalAgentConfig();
  const configId = randomUUID();
  const versionId = randomUUID();
  const now = new Date().toISOString();
  const systemPrompt = DEFAULT_MERCHANT_AGENT_GUIDANCE;
  const shared = {
    tone_preset: "neutral_saudi",
    response_language_policy: "match_shopper",
    temperature: 0.25,
    max_tokens: 420,
    product_context_policy: { current_product_only_by_default: true, related_products: true },
    fallback_policy: { missing_information: "merchant_or_product_page" },
    safety_policy: { hard_code_guardrails: true, prompt_secrecy: true, no_payment_data: true },
    objection_policy: { honest_tradeoffs: true, useful_next_question: "only_when_needed" },
    advanced_settings: { answer_length: "Usually 1-2 short conversational lines", arabic_tone: "natural white Saudi Arabic", english_tone: "direct concise human sales style" },
  };
  const { error: configError } = await supabase.from("agent_configs").insert({
    id: configId, merchant_id: merchantId, name: `Nbeh — ${merchantName}`, status: "active",
    model_provider: global.modelProvider, model_name: global.modelName, system_prompt: systemPrompt,
    developer_prompt: global.developerPrompt, ...shared, created_at: now, updated_at: now,
  });
  if (configError) throw configError;
  const { error: versionError } = await supabase.from("prompt_versions").insert({
    id: versionId, agent_config_id: configId, merchant_id: merchantId, version_number: 1,
    title: "Inherited Nbeh configuration", system_prompt: systemPrompt, developer_prompt: global.developerPrompt,
    change_note: `Created automatically when the ${source} store installed Nbeh.`, status: "published",
    test_result: { passed: true, source: `${source.toLowerCase()}_install`, config_snapshot: shared }, created_at: now, published_at: now,
  });
  if (versionError) throw versionError;
  const { error: activateError } = await supabase.from("agent_configs").update({ active_version_id: versionId }).eq("id", configId);
  if (activateError) throw activateError;
  await ensureDefaultGuardrail(merchantId, configId);
  await supabase.from("dashboard_settings").upsert({ merchant_id: merchantId, dashboard_preferences: { retention_days: 90, privacy: "anonymous_visitors", demo_mode: false, ...widgetPreferencesToRecord(DEFAULT_WIDGET_PREFERENCES) } }, { onConflict: "merchant_id" });
}

export async function installSallaStore(payload: unknown): Promise<{ merchantId: string; integrationId: string; productsImported: number }> {
  const root = record(payload);
  const data = record(root.data);
  const storeId = text(root.merchant || root.store_id || root.merchant_id);
  const accessToken = text(data.access_token);
  if (!storeId || !accessToken) throw new Error("The Salla authorization event is missing its store or access token.");
  const credentialRef = sealSallaCredentials({
    accessToken,
    refreshToken: text(data.refresh_token) || null,
    issuedAt: Date.now(),
    expiresAt: normalizeSallaExpiry(data.expires_in ?? data.expires),
    scope: text(data.scope),
    tokenType: text(data.token_type) || "bearer",
  });
  if (resolveDataBackend() === "local") {
    const existing = await findSallaInstallation(storeId);
    const installationState = await readSallaInstallationState();
    const merchantId = existing?.merchantId || (installationState.installations.length === 0 ? DEMO_MERCHANT_ID : `salla-${storeId}`);
    const integrationId = `salla-integration-${storeId}`;
    const connectedAt = existing?.connectedAt || new Date().toISOString();
    const profile = await getSallaStoreProfile(credentialRef, storeId);
    const products = await syncAllSallaProducts({ merchantId, integrationId, externalStoreId: storeId, credentialRef });
    await writeSallaInstallation({
      storeId,
      merchantId,
      merchantPublicKey: publicKey(storeId),
      merchantName: profile.name,
      credentialRef,
      products,
      connectedAt,
      lastSyncedAt: new Date().toISOString(),
    });
    return { merchantId, integrationId, productsImported: products.length };
  }
  const supabase = createServiceClient();
  const profile = await getSallaStoreProfile(credentialRef, storeId);
  if (profile.storeId !== storeId) throw new Error("The signed Salla store and access token do not identify the same store.");
  const { data: connected } = await supabase.from("platform_integrations").select("*").eq("provider", "salla").eq("external_store_id", storeId).maybeSingle();
  let merchantId = text(connected?.merchant_id);
  let integrationId = text(connected?.id);

  if (!merchantId && founderStoreId() === storeId) {
    const { data: founderDemoIntegration } = await supabase.from("platform_integrations").select("*").eq("merchant_id", DEMO_MERCHANT_ID).eq("provider", "salla").in("status", ["not_connected", "pending", "error"]).maybeSingle();
    if (founderDemoIntegration) {
      merchantId = DEMO_MERCHANT_ID;
      integrationId = text(founderDemoIntegration.id);
    }
  }

  if (!merchantId) {
    merchantId = randomUUID();
    integrationId = randomUUID();
    const { error: merchantError } = await supabase.from("merchants").insert({
      id: merchantId, business_name: profile.name, display_name: profile.name, email: profile.email,
      platform_type: "salla", public_key: publicKey(storeId), allowed_widget_origins: profile.allowedOrigins, status: "active",
    });
    if (merchantError) throw merchantError;
    await provisionDefaultAgent(merchantId, profile.name, "Salla");
    const { error: integrationError } = await supabase.from("platform_integrations").insert({
      id: integrationId, merchant_id: merchantId, provider: "salla", status: "pending",
      scopes: [], external_store_id: storeId, provider_config: { oauth_mode: "easy" },
    });
    if (integrationError) throw integrationError;
  }

  const now = new Date().toISOString();
  const scopes = text(data.scope).split(/\s+/).filter(Boolean);
  const { error: connectionError } = await supabase.from("platform_integrations").update({
    status: "connected", connected_at: now, external_store_id: storeId, encrypted_credential_ref: credentialRef,
    scopes, provider_config: { oauth_mode: "easy", token_encrypted: true, token_expires_at: normalizeSallaExpiry(data.expires_in ?? data.expires) },
    metadata_json: { note: "Connected through Salla Easy Mode.", store_url: profile.url }, updated_at: now,
  }).eq("id", integrationId).eq("merchant_id", merchantId);
  if (connectionError) throw connectionError;
  const { error: merchantUpdateError } = await supabase.from("merchants").update({
    business_name: profile.name,
    display_name: profile.name,
    email: profile.email,
    allowed_widget_origins: profile.allowedOrigins,
    platform_type: merchantId === DEMO_MERCHANT_ID ? "multi" : "salla",
    updated_at: now,
  }).eq("id", merchantId);
  if (merchantUpdateError) throw merchantUpdateError;
  await provisionDefaultAgent(merchantId, profile.name, "Salla");

  try {
    const products = await syncAllSallaProducts({
      merchantId,
      integrationId,
      externalStoreId: storeId,
      credentialRef,
      persistCredentialRef: async (nextRef) => {
        const { error } = await supabase.from("platform_integrations").update({ encrypted_credential_ref: nextRef, updated_at: new Date().toISOString() }).eq("id", integrationId).eq("merchant_id", merchantId);
        if (error) throw error;
      },
    });
    await replaceSallaProducts(merchantId, products);
    const { error: syncUpdateError } = await supabase.from("platform_integrations").update({ last_synced_at: new Date().toISOString(), status: "connected", updated_at: new Date().toISOString() }).eq("id", integrationId).eq("merchant_id", merchantId);
    if (syncUpdateError) throw syncUpdateError;
    return { merchantId, integrationId, productsImported: products.length };
  } catch (error) {
    await supabase.from("platform_integrations").update({
      status: "error",
      metadata_json: { note: "Salla connected, but the initial catalog synchronization failed. Retry or reconnect the store." },
      updated_at: new Date().toISOString(),
    }).eq("id", integrationId).eq("merchant_id", merchantId);
    throw error;
  }
}

export async function refreshSallaStore(storeId: string): Promise<number> {
  if (resolveDataBackend() === "supabase") {
    const supabase = createServiceClient();
    const { data: integration, error } = await supabase.from("platform_integrations").select("id,merchant_id,external_store_id,encrypted_credential_ref").eq("provider", "salla").eq("external_store_id", storeId).eq("status", "connected").maybeSingle();
    if (error) throw error;
    if (!integration?.merchant_id || !integration.encrypted_credential_ref) return 0;
    const products = await syncAllSallaProducts({
      merchantId: integration.merchant_id,
      integrationId: integration.id,
      externalStoreId: storeId,
      credentialRef: integration.encrypted_credential_ref,
      persistCredentialRef: async (nextRef) => {
        const { error: credentialError } = await supabase.from("platform_integrations").update({ encrypted_credential_ref: nextRef, updated_at: new Date().toISOString() }).eq("id", integration.id).eq("merchant_id", integration.merchant_id);
        if (credentialError) throw credentialError;
      },
    });
    await replaceSallaProducts(integration.merchant_id, products);
    const { error: updateError } = await supabase.from("platform_integrations").update({ last_synced_at: new Date().toISOString() }).eq("id", integration.id).eq("merchant_id", integration.merchant_id);
    if (updateError) throw updateError;
    return products.length;
  }
  const installation = await findSallaInstallation(storeId);
  if (!installation) return 0;
  const products = await syncAllSallaProducts({
    merchantId: installation.merchantId,
    integrationId: `salla-integration-${storeId}`,
    externalStoreId: storeId,
    credentialRef: installation.credentialRef,
  });
  await writeSallaInstallation({ ...installation, products, lastSyncedAt: new Date().toISOString() });
  return products.length;
}
