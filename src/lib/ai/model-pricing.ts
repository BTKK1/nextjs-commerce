export interface ModelPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  source: "openrouter" | "deepseek";
}

// Snapshot of the provider rates used by Nbeh. Keeping the rates beside the
// application code makes historical wallet estimates reproducible instead of
// changing whenever a provider updates its public catalog.
export const MODEL_PRICING_USD: Record<string, ModelPricing> = {
  "z-ai/glm-5.3-flash": { inputUsdPerMillionTokens: 0.075, outputUsdPerMillionTokens: 0.25, source: "openrouter" },
  "google/gemini-2.5-flash-lite": { inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.4, source: "openrouter" },
  "google/gemini-2.5-flash": { inputUsdPerMillionTokens: 0.3, outputUsdPerMillionTokens: 2.5, source: "openrouter" },
  "google/gemini-2.5-pro": { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 10, source: "openrouter" },
  "anthropic/claude-sonnet-4.6": { inputUsdPerMillionTokens: 3, outputUsdPerMillionTokens: 15, source: "openrouter" },
  "openai/gpt-4.1-mini": { inputUsdPerMillionTokens: 0.4, outputUsdPerMillionTokens: 1.6, source: "openrouter" },
  "qwen/qwen3-235b-a22b-2507": { inputUsdPerMillionTokens: 0.09, outputUsdPerMillionTokens: 0.55, source: "openrouter" },
  "qwen/qwen3.5-flash-02-23": { inputUsdPerMillionTokens: 0.065, outputUsdPerMillionTokens: 0.26, source: "openrouter" },
  "deepseek/deepseek-chat": { inputUsdPerMillionTokens: 0.26, outputUsdPerMillionTokens: 1.03, source: "openrouter" },
  "deepseek/deepseek-v4-flash": { inputUsdPerMillionTokens: 0.07686, outputUsdPerMillionTokens: 0.15372, source: "openrouter" },
  "deepseek-chat": { inputUsdPerMillionTokens: 0.27, outputUsdPerMillionTokens: 1.1, source: "deepseek" },
};

export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING_USD[model] ?? null;
}

export function estimateModelCostUsd(
  model: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  const pricing = getModelPricing(model);
  if (!pricing || promptTokens == null || completionTokens == null) return null;
  return Number((
    (promptTokens / 1_000_000) * pricing.inputUsdPerMillionTokens
    + (completionTokens / 1_000_000) * pricing.outputUsdPerMillionTokens
  ).toFixed(6));
}
