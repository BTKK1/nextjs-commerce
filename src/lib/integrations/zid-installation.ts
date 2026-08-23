import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getCatalogProvider } from "@/lib/catalog";
import { catalogProductToSupabaseRow } from "@/lib/catalog/supabase-mapper";
import type { CatalogProviderConnection } from "@/lib/catalog/provider";
import { ensureZidProductWebhooks, exchangeZidAuthorizationCode, getZidStoreProfile } from "@/lib/integrations/zid-client";
import { sealZidCredentials } from "@/lib/integrations/zid-credentials";
import { provisionDefaultAgent } from "@/lib/integrations/salla-installation";
import { DEMO_MERCHANT_ID } from "@/lib/supabase/constants";
import type { CatalogProduct } from "@/lib/types";
import { createServiceClient } from "@/utils/supabase/server";

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function publicKey(storeId: string, storeUuid: string | null): string {
  return storeUuid || `zid_${createHash("sha256").update(storeId).digest("hex").slice(0, 24)}`;
}

function founderStoreId(): string | null {
  return process.env.FOUNDER_ZID_STORE_ID?.trim() || null;
}

function allowedOrigins(storeUrl: string | null): string[] {
  if (!storeUrl) return [];
  try {
    const url = new URL(storeUrl.startsWith("http") ? storeUrl : `https://${storeUrl}`);
    return url.protocol === "https:" || url.protocol === "http:" ? [url.origin] : [];
  } catch {
    return [];
  }
}

export async function syncAllZidProducts(connection: CatalogProviderConnection): Promise<CatalogProduct[]> {
  const provider = getCatalogProvider("zid");
  const products = new Map<string, CatalogProduct>();
  let cursor: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const result = await provider.syncCatalog(connection, cursor);
    for (const product of result.products) products.set(product.externalId || product.slug, product);
    if (result.complete || !result.cursor) return [...products.values()];
    if (result.cursor === cursor) throw new Error("Zid catalog pagination did not advance.");
    cursor = result.cursor;
  }
  throw new Error("Zid catalog exceeded the supported 100-page synchronization limit.");
}

async function replaceZidProducts(merchantId: string, products: CatalogProduct[]) {
  const supabase = createServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("id,external_id")
    .eq("merchant_id", merchantId)
    .eq("platform", "zid");
  if (existingError) throw existingError;
  if (products.length) {
    const { error: productError } = await supabase.from("products").upsert(
      products.map((product) => catalogProductToSupabaseRow(product, merchantId, "zid")),
      { onConflict: "merchant_id,platform,slug" },
    );
    if (productError) throw productError;
  }
  const currentIds = new Set(products.map((product) => product.externalId).filter(Boolean));
  const staleIds = (existing ?? [])
    .filter((row) => row.external_id && !currentIds.has(row.external_id))
    .map((row) => row.id);
  for (let index = 0; index < staleIds.length; index += 100) {
    const { error: deleteError } = await supabase.from("products").delete().eq("merchant_id", merchantId).eq("platform", "zid").in("id", staleIds.slice(index, index + 100));
    if (deleteError) throw deleteError;
  }
}

export interface ZidInstallationResult {
  merchantId: string;
  integrationId: string;
  storeId: string;
  productsImported: number;
}

export async function installZidStore(code: string, oauthStateId?: string | null): Promise<ZidInstallationResult> {
  const credentials = await exchangeZidAuthorizationCode(code);
  const profile = await getZidStoreProfile(credentials);
  const credentialRef = sealZidCredentials(credentials);
  const supabase = createServiceClient();

  let merchantId = "";
  let integrationId = "";
  if (oauthStateId) {
    const { data: state, error: stateError } = await supabase
      .from("oauth_states")
      .select("merchant_id,integration_id")
      .eq("id", oauthStateId)
      .eq("provider", "zid")
      .maybeSingle();
    if (stateError) throw stateError;
    merchantId = text(state?.merchant_id);
    integrationId = text(state?.integration_id);
  }

  if ((!merchantId || !integrationId) && founderStoreId() === profile.storeId) {
    const { data: connected, error: connectedError } = await supabase
      .from("platform_integrations")
      .select("id,merchant_id")
      .eq("provider", "zid")
      .eq("external_store_id", profile.storeId)
      .maybeSingle();
    if (connectedError) throw connectedError;
    merchantId = text(connected?.merchant_id);
    integrationId = text(connected?.id);
  }

  if (!merchantId || !integrationId) {
    const { data: founderPlaceholder } = await supabase
      .from("platform_integrations")
      .select("id,merchant_id")
      .eq("merchant_id", DEMO_MERCHANT_ID)
      .eq("provider", "zid")
      .in("status", ["not_connected", "pending", "error"])
      .maybeSingle();
    if (founderPlaceholder) {
      merchantId = DEMO_MERCHANT_ID;
      integrationId = text(founderPlaceholder.id);
    }
  }

  if (!merchantId || !integrationId) {
    merchantId = randomUUID();
    integrationId = randomUUID();
    const { error: merchantError } = await supabase.from("merchants").insert({
      id: merchantId,
      business_name: profile.name,
      display_name: profile.name,
      email: profile.email,
      platform_type: "zid",
      public_key: publicKey(profile.storeId, profile.storeUuid),
      allowed_widget_origins: allowedOrigins(profile.url),
      status: "active",
    });
    if (merchantError) throw merchantError;
    await provisionDefaultAgent(merchantId, profile.name, "Zid");
    const { error: integrationError } = await supabase.from("platform_integrations").insert({
      id: integrationId,
      merchant_id: merchantId,
      provider: "zid",
      status: "pending",
      scopes: ["account.read", "products.read", "third_webhook_write", "third_js_write"],
      external_store_id: profile.storeId,
      provider_config: { oauth_mode: "authorization_code", store_uuid: profile.storeUuid },
    });
    if (integrationError) throw integrationError;
  }

  const now = new Date().toISOString();
  const { error: connectionError } = await supabase.from("platform_integrations").update({
    status: "connected",
    connected_at: now,
    external_store_id: profile.storeId,
    encrypted_credential_ref: credentialRef,
    scopes: ["account.read", "products.read", "third_webhook_write", "third_js_write"],
    provider_config: { oauth_mode: "authorization_code", store_uuid: profile.storeUuid, token_encrypted: true, token_expires_at: credentials.expiresAt },
    metadata_json: { note: "Connected through Zid OAuth 2.0.", store_url: profile.url },
    updated_at: now,
  }).eq("id", integrationId).eq("merchant_id", merchantId);
  if (connectionError) throw connectionError;

  const origins = allowedOrigins(profile.url);
  const { error: merchantUpdateError } = await supabase.from("merchants").update({
    business_name: profile.name,
    display_name: profile.name,
    email: profile.email,
    public_key: publicKey(profile.storeId, profile.storeUuid),
    allowed_widget_origins: origins,
    platform_type: merchantId === DEMO_MERCHANT_ID ? "multi" : "zid",
    updated_at: now,
  }).eq("id", merchantId);
  if (merchantUpdateError) throw merchantUpdateError;
  await provisionDefaultAgent(merchantId, profile.name, "Zid");
  try {
    await ensureZidProductWebhooks(credentials, profile.storeId);
    const products = await syncAllZidProducts({
      merchantId,
      integrationId,
      externalStoreId: profile.storeId,
      credentialRef,
      persistCredentialRef: async (nextRef) => {
        const { error } = await supabase.from("platform_integrations").update({ encrypted_credential_ref: nextRef, updated_at: new Date().toISOString() }).eq("id", integrationId).eq("merchant_id", merchantId);
        if (error) throw error;
      },
    });
    await replaceZidProducts(merchantId, products);
    const { error: syncUpdateError } = await supabase.from("platform_integrations").update({ last_synced_at: new Date().toISOString(), status: "connected", updated_at: new Date().toISOString() }).eq("id", integrationId).eq("merchant_id", merchantId);
    if (syncUpdateError) throw syncUpdateError;
    return { merchantId, integrationId, storeId: profile.storeId, productsImported: products.length };
  } catch (error) {
    await supabase.from("platform_integrations").update({
      status: "error",
      metadata_json: { note: "Zid connected, but storefront setup or the initial catalog synchronization failed. Retry or reconnect the store.", store_url: profile.url },
      updated_at: new Date().toISOString(),
    }).eq("id", integrationId).eq("merchant_id", merchantId);
    throw error;
  }
}

export async function refreshZidStore(storeId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data: integration, error } = await supabase.from("platform_integrations")
    .select("id,merchant_id,external_store_id,encrypted_credential_ref")
    .eq("provider", "zid")
    .eq("external_store_id", storeId)
    .eq("status", "connected")
    .maybeSingle();
  if (error) throw error;
  if (!integration?.merchant_id || !integration.encrypted_credential_ref) return 0;
  const products = await syncAllZidProducts({
    merchantId: integration.merchant_id,
    integrationId: integration.id,
    externalStoreId: storeId,
    credentialRef: integration.encrypted_credential_ref,
    persistCredentialRef: async (nextRef) => {
      const { error: updateError } = await supabase.from("platform_integrations").update({ encrypted_credential_ref: nextRef, updated_at: new Date().toISOString() }).eq("id", integration.id).eq("merchant_id", integration.merchant_id);
      if (updateError) throw updateError;
    },
  });
  await replaceZidProducts(integration.merchant_id, products);
  await supabase.from("platform_integrations").update({ last_synced_at: new Date().toISOString() }).eq("id", integration.id).eq("merchant_id", integration.merchant_id);
  return products.length;
}
