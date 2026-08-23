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
  if (persistenceConfigured && dataBackend === "supabase") {
    try {
      const { error } = await createServiceClient().from("merchants").select("id").limit(1);
      databaseReachable = !error;
    } catch {
      databaseReachable = false;
    }
  }
  const commerceProviders = [getProviderReadiness("salla"), getProviderReadiness("zid")];
  const commerceProvidersConfigured = dataBackend === "local" || commerceProviders.every((provider) => provider.credentialsConfigured && provider.webhookConfigured);
  const status = persistenceConfigured && databaseReachable && commerceProvidersConfigured ? "ok" : "degraded";
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
    dataBackend,
    persistenceConfigured,
    databaseReachable,
    abuseControlsConfigured,
    commerceProvidersConfigured,
    commerceProviders: commerceProviders.map((provider) => ({ provider: provider.provider, ready: provider.credentialsConfigured && provider.webhookConfigured })),
    catalogProvider,
    loggingEnabled: persistenceConfigured,
    insightsEnabled: persistenceConfigured,
    timestamp: new Date().toISOString(),
  }, { status: status === "ok" ? 200 : 503 });
}
