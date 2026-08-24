import type { ProductAgentProvider } from "@/lib/ai/model-config";

export interface SelectableModel {
  id: string;
  label: string;
  description: string;
}

export const PROVIDER_LABELS: Record<ProductAgentProvider, string> = {
  openrouter: "OpenRouter",
  "deepseek-direct": "DeepSeek direct",
};

export const SELECTABLE_MODELS: Record<ProductAgentProvider, readonly SelectableModel[]> = {
  openrouter: [
    { id: "stealth/ox-alpha", label: "OX Alpha", description: "Nbeh production model · Recommended" },
    { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Fast and economical · Recommended" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Balanced speed and reasoning" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Higher reasoning quality" },
    { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", description: "Strong conversation and judgment" },
    { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini", description: "Fast instruction following" },
    { id: "qwen/qwen3-235b-a22b-2507", label: "Qwen3 235B Instruct", description: "Efficient multilingual model" },
    { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", description: "Fast, low-cost multilingual sales conversations" },
    { id: "deepseek/deepseek-chat", label: "DeepSeek V3", description: "DeepSeek through OpenRouter" },
  ],
  "deepseek-direct": [
    { id: "deepseek-chat", label: "DeepSeek Chat", description: "General sales conversations · Recommended" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", description: "Deeper reasoning, higher latency" },
  ],
};

export function isProductAgentProvider(value: string): value is ProductAgentProvider {
  return value === "openrouter" || value === "deepseek-direct";
}

export function defaultModelForProvider(provider: ProductAgentProvider): string {
  return SELECTABLE_MODELS[provider][0].id;
}

export function isModelAvailableForProvider(provider: ProductAgentProvider, model: string): boolean {
  return SELECTABLE_MODELS[provider].some((item) => item.id === model);
}
