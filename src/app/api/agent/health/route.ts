import { NextResponse } from "next/server";
import { getModelConfig, PRODUCT_AGENT_PROMPT_VERSION } from "@/lib/ai/model-config";
import { getCatalogProvider } from "@/lib/catalog";

export const dynamic = "force-dynamic";

function getBuildId() {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || "local-preview";
}

export async function GET() {
  const modelConfig = getModelConfig();
  const catalogProvider = getCatalogProvider();

  return NextResponse.json({
    status: "ok",
    buildId: getBuildId(),
    agentMode: modelConfig.mode,
    provider: modelConfig.provider,
    model: modelConfig.model,
    providerRoute: modelConfig.routes.map((route) => `${route.provider}:${route.model}`),
    promptVersion: PRODUCT_AGENT_PROMPT_VERSION,
    openrouterKeyConfigured: Boolean(modelConfig.apiKey),
    catalogProvider: catalogProvider.provider,
    loggingEnabled: true,
    insightsEnabled: true,
    timestamp: new Date().toISOString(),
  });
}
