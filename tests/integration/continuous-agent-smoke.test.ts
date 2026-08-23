import { beforeAll, describe, expect, it } from "vitest";
import { demoProducts } from "@/data/catalog";
import { generateAgentAnswer } from "@/lib/agent/llm-client";
import { getModelConfig } from "@/lib/ai/model-config";
import { getSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { resetDatabaseForTests } from "@/lib/storage/json-store";
import { createSeedDatabase } from "@/lib/storage/seed";

const OX_ALPHA_MODEL = "stealth/ox-alpha";

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

  it("uses only OX Alpha for product-grounded Arabic guidance", async () => {
    const config = getModelConfig();
    expect(config.routes).toEqual([{ provider: "openrouter", model: OX_ALPHA_MODEL }]);
    expect(config.fallbacksEnabled).toBe(false);

    const slug = "everyday-leather-tote";
    const product = demoProducts.find((item) => item.slug === slug);
    expect(product).toBeTruthy();
    const knowledge = getSellerKnowledgeForProduct(slug);
    expect(knowledge).toBeTruthy();

    const answer = await generateAgentAnswer(
      product!,
      "كم سعره ووش خامته؟",
      {
        path: `/product/${slug}`,
        title: product!.name,
        productName: product!.name,
        locale: "ar",
      },
      knowledge!,
    );

    expect(answer.provider).toBe("openrouter");
    expect(answer.model).toBe(OX_ALPHA_MODEL);
    expect(answer.providerRoute).not.toMatch(/gemini|qwen|deepseek/i);
    expect(
      answer.fallbackReason,
      `OX Alpha failed: ${answer.errorCode ?? "unknown"} (${answer.errorMessage ?? "no provider message"}); route=${answer.providerRoute}`,
    ).toBeUndefined();
    expect(answer.text).toContain("320");
    expect(answer.text).toMatch(/جلد|leather/i);
  }, 180_000);
});
