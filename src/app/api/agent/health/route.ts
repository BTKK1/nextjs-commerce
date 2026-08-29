import { NextResponse } from "next/server";
import { getModelConfig, PRODUCT_AGENT_PROMPT_VERSION } from "@/lib/ai/model-config";
import { getCatalogProvider } from "@/lib/catalog";
import { resolveDataBackend } from "@/lib/backend/mode";
import { hasSupabaseServiceConfig } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/server";
import { getProviderReadiness } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

function getBuildId() {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || "local-preview";
}

export async function GET() {
  const modelConfig = getModelConfig();
  const dataBackend = resolveDataBackend();
  const abuseControlsConfigured = dataBackend === "local"
    ? true
    : Boolean(process.env.AGENT_RATE_LIMIT_SECRET && process.env.AGENT_RATE_LIMIT_SECRET.length >= 32);
  const persistenceConfigured = dataBackend === "local"
    ? true
    : hasSupabaseServiceConfig() && process.env.SUPABASE_AGENT_ENABLED === "true" && abuseControlsConfigured;
  let databaseReachable = dataBackend === "local";
  let modelRuntimeHealthy = dataBackend === "local";
  let latestModelFailure: string | null = null;
  let commerceRuntimeHealthy = dataBackend === "local";
  let commerceRuntime = ["salla", "zid"].map((provider) => ({
    provider,
    connected: dataBackend === "local",
    catalogReady: dataBackend === "local",
    storeId: null as string | null,
    sampleProductRef: null as string | null,
  }));
  if (persistenceConfigured && dataBackend === "supabase") {
    try {
      const supabase = createServiceClient();
      const [merchantResult, integrationResult, productResult, runtimeResult] = await Promise.all([
        supabase.from("merchants").select("id").limit(1),
        supabase.from("platform_integrations").select("merchant_id,provider,status,external_store_id,encrypted_credential_ref,last_synced_at").in("provider", ["salla", "zid"]),
        supabase.from("products").select("merchant_id,platform,external_id,slug").in("platform", ["salla", "zid"]),
        supabase.from("audit_logs").select("action,details_json,created_at").in("action", ["agent_answer", "agent_answer_fallback"]).order("created_at", { ascending: false }).limit(1),
      ]);
      databaseReachable = !merchantResult.error && !integrationResult.error && !productResult.error && !runtimeResult.error;
      if (databaseReachable) {
        const products = productResult.data ?? [];
        const latestRuntime = runtimeResult.data?.[0];
        const runtimeDetails = latestRuntime?.details_json && typeof latestRuntime.details_json === "object"
          ? latestRuntime.details_json as Record<string, unknown>
          : {};
        latestModelFailure = runtimeDetails.fallback_reason === "model_error"
          ? String(runtimeDetails.provider_error_code || "model_error")
          : null;
        modelRuntimeHealthy = latestModelFailure == null;
        commerceRuntime = ["salla", "zid"].map((provider) => {
          const connected = (integrationResult.data ?? []).filter((row) => row.provider === provider && row.status === "connected");
          const readyIntegration = connected.find((row) => Boolean(row.external_store_id)
            && Boolean(row.encrypted_credential_ref)
            && Boolean(row.last_synced_at)
            && products.some((product) => product.platform === provider && product.merchant_id === row.merchant_id));
          const sampleProduct = readyIntegration
            ? products.find((product) => product.platform === provider && product.merchant_id === readyIntegration.merchant_id)
            : null;
          return {
            provider,
            connected: connected.length > 0,
            catalogReady: Boolean(readyIntegration && sampleProduct),
            storeId: readyIntegration?.external_store_id ? String(readyIntegration.external_store_id) : null,
            sampleProductRef: sampleProduct ? String(sampleProduct.external_id || sampleProduct.slug) : null,
          };
        });
        commerceRuntimeHealthy = commerceRuntime.every((provider) => provider.connected && provider.catalogReady);
      }
    } catch {
      databaseReachable = false;
      commerceRuntimeHealthy = false;
    }
  }
  const commerceProviders = [getProviderReadiness("salla"), getProviderReadiness("zid")];
  const commerceProvidersConfigured = dataBackend === "local" || commerceProviders.every((provider) => provider.credentialsConfigured && provider.webhookConfigured);
  const status = persistenceConfigured && databaseReachable && commerceProvidersConfigured && commerceRuntimeHealthy && modelRuntimeHealthy ? "ok" : "degraded";
  const catalogProvider = dataBackend === "local" ? getCatalogProvider().provider : "supabase";

  return NextResponse.json({
    status,
    buildId: getBuildId(),
    agentMode: modelConfig.mode,
    provider: modelConfig.provider,
    model: modelConfig.model,
    providerRoute: modelConfig.routes.map((route) => `${route.provider}:${route.model}`),
    promptVersion: PRODUCT_AGENT_PROMPT_VERSION,
    openrouterKeyConfigured: Boolean(modelConfig.apiKey),
    openrouterCredentialGuardEnabled: modelConfig.credentialGuardEnabled,
    dataBackend,
    persistenceConfigured,
    databaseReachable,
    modelRuntimeHealthy,
    latestModelFailure,
    abuseControlsConfigured,
    commerceProvidersConfigured,
    commerceProviders: commerceProviders.map((provider) => ({ provider: provider.provider, ready: provider.credentialsConfigured && provider.webhookConfigured })),
    commerceRuntimeHealthy,
    commerceRuntime,
    catalogProvider,
    loggingEnabled: persistenceConfigured,
    insightsEnabled: persistenceConfigured,
    timestamp: new Date().toISOString(),
  }, { status: status === "ok" ? 200 : 503 });
}
