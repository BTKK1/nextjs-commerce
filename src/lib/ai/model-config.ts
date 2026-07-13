import type { AgentMode } from "@/lib/types";

export type ProductAgentProvider = "openrouter" | "deepseek-direct";

export const TING_SALES_AGENT_PRIMARY_MODEL = "google/gemini-2.5-flash-lite";
export const TING_SALES_AGENT_FALLBACK_MODEL = "qwen/qwen3-235b-a22b-2507";
export const TING_SALES_AGENT_FALLBACK2_MODEL = "deepseek-chat";
export const FALLBACK_OPENROUTER_MODEL = TING_SALES_AGENT_PRIMARY_MODEL;
export const PRODUCT_AGENT_PROMPT_VERSION = "product-agent-grounded-sales-v2";

export interface ProductAgentRoute {
  provider: ProductAgentProvider;
  model: string;
}

export interface ModelConfig {
  provider: "openrouter";
  model: string;
  mode: AgentMode;
  routes: ProductAgentRoute[];
  apiKey?: string;
  deepseekApiKey?: string;
  siteUrl?: string;
  appName?: string;
  source: "fallback_empty_repo" | "env";
}

export function getModelConfig(): ModelConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const model =
    process.env.SALES_AGENT_MODEL ||
    process.env.PRODUCT_AGENT_MODEL ||
    process.env.OPENROUTER_MODEL ||
    FALLBACK_OPENROUTER_MODEL;
  const fallbackModel =
    process.env.SALES_AGENT_FALLBACK_MODEL ||
    process.env.PRODUCT_AGENT_FALLBACK_MODEL ||
    TING_SALES_AGENT_FALLBACK_MODEL;
  const fallback2Model =
    process.env.SALES_AGENT_FALLBACK2_MODEL ||
    process.env.PRODUCT_AGENT_FALLBACK2_MODEL ||
    TING_SALES_AGENT_FALLBACK2_MODEL;
  const routes: ProductAgentRoute[] = [
    { provider: "openrouter", model },
    { provider: "openrouter", model: fallbackModel },
    { provider: "deepseek-direct", model: fallback2Model }
  ];
  const mode: AgentMode = "live";

  return {
    provider: "openrouter",
    model,
    routes,
    mode,
    apiKey,
    deepseekApiKey,
    siteUrl: process.env.OPENROUTER_SITE_URL,
    appName: process.env.OPENROUTER_APP_NAME || "Saleh Stores AI Sales Agent Demo",
    source: process.env.SALES_AGENT_MODEL || process.env.PRODUCT_AGENT_MODEL || process.env.OPENROUTER_MODEL ? "env" : "fallback_empty_repo"
  };
}
