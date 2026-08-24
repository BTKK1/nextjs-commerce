import { describe, expect, it } from "vitest";
import { defaultModelForProvider, isModelAvailableForProvider, isProductAgentProvider, SELECTABLE_MODELS } from "@/lib/ai/model-catalog";

describe("global model catalog", () => {
  it("contains selectable models for every supported provider", () => {
    expect(SELECTABLE_MODELS.openrouter.length).toBeGreaterThan(3);
    expect(SELECTABLE_MODELS["deepseek-direct"].length).toBeGreaterThan(0);
  });

  it("keeps models scoped to their provider", () => {
    expect(isModelAvailableForProvider("openrouter", "stealth/ox-alpha")).toBe(true);
    expect(isModelAvailableForProvider("openrouter", "google/gemini-2.5-flash-lite")).toBe(true);
    expect(isModelAvailableForProvider("deepseek-direct", "google/gemini-2.5-flash-lite")).toBe(false);
    expect(isModelAvailableForProvider("deepseek-direct", "deepseek-chat")).toBe(true);
    expect(isModelAvailableForProvider("openrouter", "deepseek/deepseek-v4-flash")).toBe(true);
  });

  it("provides a valid default whenever the provider changes", () => {
    expect(defaultModelForProvider("openrouter")).toBe("stealth/ox-alpha");
    expect(isModelAvailableForProvider("openrouter", defaultModelForProvider("openrouter"))).toBe(true);
    expect(isModelAvailableForProvider("deepseek-direct", defaultModelForProvider("deepseek-direct"))).toBe(true);
    expect(isProductAgentProvider("unsupported")).toBe(false);
  });
});
