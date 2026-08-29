import { createHash, timingSafeEqual } from "node:crypto";
import type { AgentMode } from "@/lib/types";

export type ProductAgentProvider = "openrouter" | "deepseek-direct";

export const NBEH_PRODUCTION_MODEL = "z-ai/glm-5.3-flash";
export const TING_SALES_AGENT_PRIMARY_MODEL = NBEH_PRODUCTION_MODEL;
export const TING_SALES_AGENT_FALLBACK_MODEL = "qwen/qwen3-235b-a22b-2507";
export const TING_SALES_AGENT_FALLBACK2_MODEL = "deepseek-chat";
export const RETIRED_NBEH_MODEL_ALIASES = new Set(["stealth/ox-alpha"]);
export const FALLBACK_OPENROUTER_MODEL = NBEH_PRODUCTION_MODEL;
export const PRODUCT_AGENT_PROMPT_VERSION = "product-agent-grounded-sales-v2";

function modelFallbacksEnabled(): boolean {
  return process.env.SALES_AGENT_DISABLE_FALLBACKS !== "true"
    && process.env.PRODUCT_AGENT_DISABLE_FALLBACKS !== "true";
}

export interface ProductAgentRoute {
  provider: ProductAgentProvider;
  model: string;
}

export interface ModelConfig {
  provider: "openrouter";
  model: string;
  mode: AgentMode;
  routes: ProductAgentRoute[];
  fallbacksEnabled: boolean;
  apiKey?: string;
  deepseekApiKey?: string;
  siteUrl?: string;
  appName?: string;
  source: "fallback_empty_repo" | "env";
  credentialGuardEnabled: boolean;
}

function guardedOpenRouterApiKey(): { apiKey?: string; credentialGuardEnabled: boolean } {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || undefined;
  const credentialGuardEnabled = process.env.OPENROUTER_ENFORCE_KEY_SHA256 === "true";
  if (!credentialGuardEnabled) return { apiKey, credentialGuardEnabled };

  const expectedHash = process.env.OPENROUTER_KEY_SHA256?.trim().toLowerCase();
  if (!apiKey) throw new Error("The approved Saleh OpenRouter credential is not configured.");
  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error("OPENROUTER_KEY_SHA256 must contain the approved Saleh credential fingerprint.");
  }

  const actual = createHash("sha256").update(apiKey).digest();
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("The configured OpenRouter credential is not the approved Saleh credential.");
  }
  return { apiKey, credentialGuardEnabled };
}

export function getModelConfig(): ModelConfig {
  const { apiKey, credentialGuardEnabled } = guardedOpenRouterApiKey();
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const configuredModel =
    process.env.SALES_AGENT_MODEL ||
    process.env.PRODUCT_AGENT_MODEL ||
    process.env.OPENROUTER_MODEL ||
    FALLBACK_OPENROUTER_MODEL;
  // OpenRouter retired the temporary OX Alpha alias after revealing that it
  // was GLM-5.3 Flash. Normalize stale deployment variables to the official
  // route so an old alias cannot take every storefront agent offline again.
  const model = RETIRED_NBEH_MODEL_ALIASES.has(configuredModel)
    ? NBEH_PRODUCTION_MODEL
    : configuredModel;
  const fallbackModel =
    process.env.SALES_AGENT_FALLBACK_MODEL ||
    process.env.PRODUCT_AGENT_FALLBACK_MODEL ||
    TING_SALES_AGENT_FALLBACK_MODEL;
  const fallback2Model =
    process.env.SALES_AGENT_FALLBACK2_MODEL ||
    process.env.PRODUCT_AGENT_FALLBACK2_MODEL ||
    TING_SALES_AGENT_FALLBACK2_MODEL;
  const fallbacksEnabled = modelFallbacksEnabled();
  const routes: ProductAgentRoute[] = fallbacksEnabled
    ? [
        { provider: "openrouter", model },
        { provider: "openrouter", model: fallbackModel },
        { provider: "deepseek-direct", model: fallback2Model },
      ]
    : [{ provider: "openrouter", model }];
  const mode: AgentMode = "live";

  return {
    provider: "openrouter",
    model,
    routes,
    fallbacksEnabled,
    mode,
    apiKey,
    deepseekApiKey,
    siteUrl: process.env.OPENROUTER_SITE_URL,
    appName: process.env.OPENROUTER_APP_NAME || "Nbeh AI",
    source: process.env.SALES_AGENT_MODEL || process.env.PRODUCT_AGENT_MODEL || process.env.OPENROUTER_MODEL ? "env" : "fallback_empty_repo",
    credentialGuardEnabled,
  };
}
