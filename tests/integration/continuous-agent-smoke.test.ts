import { beforeAll, describe, expect, it } from "vitest";
import { demoProducts } from "@/data/catalog";
import { generateAgentAnswer } from "@/lib/agent/llm-client";
import { getModelConfig } from "@/lib/ai/model-config";
import { getSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { resetDatabaseForTests } from "@/lib/storage/json-store";
import { createSeedDatabase } from "@/lib/storage/seed";

const OX_ALPHA_MODEL = "stealth/ox-alpha";

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("continuous OX Alpha smoke", () => {
  beforeAll(() => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is required for continuous OX Alpha testing.");
    }
    process.env.AGENT_MODE = "live";
    process.env.DEMO_PERSISTENCE = "memory";
    process.env.SUPABASE_AGENT_ENABLED = "false";
    resetDatabaseForTests(createSeedDatabase());
  });

  it("uses only OX Alpha for English and Arabic product guidance", async () => {
    const config = getModelConfig();
    expect(config.routes).toEqual([{ provider: "openrouter", model: OX_ALPHA_MODEL }]);
    expect(config.fallbacksEnabled).toBe(false);

    const cases = [
      { slug: "everyday-leather-tote", locale: "en" as const, message: "What is this bag made of?" },
      { slug: "high-rise-straight-denim", locale: "ar" as const, message: "وش الخامة والمقاسات المتوفرة؟" },
    ];

    for (const [index, testCase] of cases.entries()) {
      if (index > 0) await wait(20_000);
      const product = demoProducts.find((item) => item.slug === testCase.slug);
      expect(product).toBeTruthy();
      const knowledge = getSellerKnowledgeForProduct(testCase.slug);
      expect(knowledge).toBeTruthy();

      let answer;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        answer = await generateAgentAnswer(
          product!,
          testCase.message,
          {
            path: `/product/${testCase.slug}`,
            title: product!.name,
            productName: product!.name,
            locale: testCase.locale,
          },
          knowledge!,
        );
        if (!answer.fallbackReason || !["rate_limited", "timeout"].includes(answer.errorCode ?? "")) break;
        if (attempt < 2) await wait(20_000);
      }

      expect(answer).toBeTruthy();
      expect(answer!.provider).toBe("openrouter");
      expect(answer!.model).toBe(OX_ALPHA_MODEL);
      expect(answer!.providerRoute).not.toMatch(/gemini|qwen|deepseek/i);
      if (answer!.fallbackReason === "model_error" && ["rate_limited", "timeout"].includes(answer!.errorCode ?? "")) {
        console.warn(`OX Alpha shared upstream is temporarily unavailable after same-model retries: ${answer!.errorCode}.`);
        return;
      }
      expect(
        answer!.fallbackReason,
        `OX Alpha failed: ${answer!.errorCode ?? "unknown"} (${answer!.errorMessage ?? "no provider message"}); route=${answer!.providerRoute}`,
      ).toBeUndefined();
      expect(answer!.text.trim().length).toBeGreaterThan(10);
    }
  }, 300_000);
});
