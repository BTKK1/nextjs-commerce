import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { canManageIntegrations } from "@/lib/auth/roles";
import { getDashboardIdentity } from "@/lib/auth/require-user";
import { getCatalogProvider } from "@/lib/catalog";
import { catalogProductToSupabaseRow } from "@/lib/catalog/supabase-mapper";
import { isCommerceProvider } from "@/lib/integrations/registry";
import { isSameOriginMutation } from "@/lib/integrations/registry";
import type { PlatformProvider } from "@/lib/types";
import { createServiceClient } from "@/utils/supabase/server";
import { syncAllSallaProducts } from "@/lib/integrations/salla-installation";
import { syncAllZidProducts } from "@/lib/integrations/zid-installation";
import { replaceCommerceProducts } from "@/lib/integrations/catalog-replacement";

export const dynamic = "force-dynamic";

function normalizeProvider(value: string): PlatformProvider | null {
  if (value === "demo_catalog" || value === "demo") return "demo_catalog";
  return isCommerceProvider(value) ? value : null;
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
  const identity = await getDashboardIdentity();
  if (!identity || !canManageIntegrations(identity.role)) return NextResponse.json({ error: "Integration administrator access required" }, { status: 403 });
  const provider = normalizeProvider((await context.params).provider);
  if (!provider) return NextResponse.json({ error: "Unsupported catalog provider" }, { status: 404 });
  const databaseProvider = provider === "demo_catalog" ? "demo" : provider;
  const supabase = createServiceClient();
  const { data: integration } = await supabase.from("platform_integrations").select("*").eq("merchant_id", identity.merchantId).eq("provider", databaseProvider).maybeSingle();
  if (!integration) return NextResponse.json({ error: "Integration record not found" }, { status: 404 });
  if (provider !== "demo_catalog" && !["connected", "pending", "error"].includes(integration.status)) {
    return NextResponse.json({ error: `${provider} is not connected; complete provider approval and OAuth first` }, { status: 409 });
  }
  if (provider !== "demo_catalog" && (!integration.external_store_id || !integration.encrypted_credential_ref)) {
    return NextResponse.json({ error: `${provider} connection is missing its store identity or secure credential reference` }, { status: 409 });
  }

  const jobId = randomUUID();
  const { error: jobError } = await supabase.from("sync_jobs").insert({ id: jobId, merchant_id: identity.merchantId, integration_id: integration.id, provider: databaseProvider, job_type: "catalog_sync", resource: "products", status: "running", started_at: new Date().toISOString() });
  if (jobError) return NextResponse.json({ error: "Could not start catalog synchronization" }, { status: 500 });
  try {
    const connection = {
      merchantId: identity.merchantId,
      integrationId: integration.id,
      externalStoreId: integration.external_store_id,
      credentialRef: integration.encrypted_credential_ref,
      persistCredentialRef: async (credentialRef: string) => {
        const { error } = await supabase.from("platform_integrations").update({ encrypted_credential_ref: credentialRef, updated_at: new Date().toISOString() }).eq("id", integration.id).eq("merchant_id", identity.merchantId);
        if (error) throw error;
      },
    };
    const products = provider === "salla"
      ? await syncAllSallaProducts(connection)
      : provider === "zid"
        ? await syncAllZidProducts(connection)
        : (await getCatalogProvider(provider).syncCatalog(connection)).products;
    if (provider === "salla" || provider === "zid") {
      await replaceCommerceProducts(identity.merchantId, provider, products);
    } else if (products.length) {
      const { error: productError } = await supabase.from("products").upsert(products.map((product) => catalogProductToSupabaseRow(product, identity.merchantId, provider)), { onConflict: "merchant_id,platform,slug" });
      if (productError) throw new Error(`Catalog normalization failed: ${productError.message}`);
    }
    const finishedAt = new Date().toISOString();
    const { error: finishError } = await supabase.from("sync_jobs").update({ status: "success", finished_at: finishedAt, records_processed: products.length, cursor: null, metadata_json: { complete: true } }).eq("id", jobId).eq("merchant_id", identity.merchantId);
    if (finishError) throw new Error(`Sync job completion failed: ${finishError.message}`);
    const { error: integrationError } = await supabase.from("platform_integrations").update({
      last_synced_at: finishedAt,
      ...(provider !== "demo_catalog" ? {
        status: "connected",
        connected_at: integration.connected_at || finishedAt,
        metadata_json: { note: `${provider === "salla" ? "Salla" : "Zid"} connection verified; full catalog synchronized.` },
      } : {}),
      updated_at: finishedAt,
    }).eq("id", integration.id).eq("merchant_id", identity.merchantId);
    if (integrationError) throw new Error(`Integration timestamp update failed: ${integrationError.message}`);
    const { error: auditError } = await supabase.rpc("record_integration_sync_audit", {
      target_merchant_id: identity.merchantId,
      target_integration_id: integration.id,
      target_job_id: jobId,
      target_provider: databaseProvider,
      target_status: "success",
      target_records_processed: products.length,
      target_error_code: null,
    });
    if (auditError) throw new Error(`Sync audit failed: ${auditError.message}`);
    return NextResponse.json({ jobId, status: "success", recordsProcessed: products.length });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message.slice(0, 240) : "Catalog sync failed";
    const failedAt = new Date().toISOString();
    await supabase.from("sync_jobs").update({ status: "failed", finished_at: failedAt, error: internalMessage }).eq("id", jobId).eq("merchant_id", identity.merchantId);
    if (provider !== "demo_catalog") {
      await supabase.from("platform_integrations").update({
        status: "error",
        metadata_json: { note: `${provider === "salla" ? "Salla" : "Zid"} remains installed, but its latest catalog refresh failed. Retry sync; reconnect only if retry says authorization is required.` },
        updated_at: failedAt,
      }).eq("id", integration.id).eq("merchant_id", identity.merchantId);
    }
    await supabase.rpc("record_integration_sync_audit", {
      target_merchant_id: identity.merchantId,
      target_integration_id: integration.id,
      target_job_id: jobId,
      target_provider: databaseProvider,
      target_status: "failed",
      target_records_processed: 0,
      target_error_code: "catalog_sync_failed",
    });
    return NextResponse.json({ jobId, error: "Catalog synchronization failed" }, { status: 502 });
  }
}
