import { afterEach, describe, expect, it, vi } from "vitest";
import { demoProducts } from "@/data/catalog";
import { formatTemplate, storeCopy } from "@/components/saleh-demo/store-i18n";
import { evaluateOutputGuardrails } from "@/lib/agent/guardrails";
import { evaluateAgentResponse } from "@/lib/agent/evaluator";
import { generateAgentAnswer } from "@/lib/agent/llm-client";
import { buildAgentSystemPrompt, buildProductContext } from "@/lib/agent/prompt-builder";
import { getModelConfig } from "@/lib/ai/model-config";
import { getSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { resetDatabaseForTests } from "@/lib/storage/json-store";
import { createSeedDatabase } from "@/lib/storage/seed";

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("prompt builder and live provider config", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the same Ting sales agent model route order", () => {
    const previous = {
      sales: process.env.SALES_AGENT_MODEL,
      salesFallback: process.env.SALES_AGENT_FALLBACK_MODEL,
      salesFallback2: process.env.SALES_AGENT_FALLBACK2_MODEL,
      product: process.env.PRODUCT_AGENT_MODEL,
      openrouter: process.env.OPENROUTER_MODEL,
    };
    delete process.env.SALES_AGENT_MODEL;
    delete process.env.SALES_AGENT_FALLBACK_MODEL;
    delete process.env.SALES_AGENT_FALLBACK2_MODEL;
    delete process.env.PRODUCT_AGENT_MODEL;
    delete process.env.OPENROUTER_MODEL;

    expect(getModelConfig().routes).toEqual([
      { provider: "openrouter", model: "google/gemini-2.5-flash-lite" },
      { provider: "openrouter", model: "qwen/qwen3-235b-a22b-2507" },
      { provider: "deepseek-direct", model: "deepseek-chat" },
    ]);

    restoreEnv("SALES_AGENT_MODEL", previous.sales);
    restoreEnv("SALES_AGENT_FALLBACK_MODEL", previous.salesFallback);
    restoreEnv("SALES_AGENT_FALLBACK2_MODEL", previous.salesFallback2);
    restoreEnv("PRODUCT_AGENT_MODEL", previous.product);
    restoreEnv("OPENROUTER_MODEL", previous.openrouter);
  });

  it("includes current product context and only scoped related products", () => {
    process.env.DEMO_PERSISTENCE = "memory";
    resetDatabaseForTests(createSeedDatabase());
    const product = demoProducts[0];
    const knowledge = getSellerKnowledgeForProduct(product.slug);
    expect(knowledge).toBeTruthy();
    const context = buildProductContext(
      product,
      {
        path: `/product/${product.slug}`,
        title: `${product.name} | Maison Vert`,
        productName: product.name,
      },
      knowledge!,
    );
    const prompt = buildAgentSystemPrompt(
      product,
      {
        path: `/product/${product.slug}`,
        title: `${product.name} | Maison Vert`,
        productName: product.name,
      },
      knowledge!,
    );

    expect(prompt).toContain("Answer only from the provided seller knowledge");
    expect(prompt).toContain("Maison Vert Assistant");
    expect(prompt).toContain("dashboard_database");
    expect(prompt).toContain("demo_catalog");
    expect(prompt).toContain(`/product/${product.slug}`);
    expect(prompt).toContain(product.name);
    expect(context.pageContext.productName).toBe(product.name);
    expect(context.relatedProducts.map((item) => item.slug)).toEqual([
      ...product.upsellProductSlugs,
      ...product.crossSellProductSlugs,
    ]);
    expect(prompt).not.toContain("Machine compatibility list is not exhaustive");
    expect(prompt).toContain("Do not offer to add items to the bag/cart");
    expect(prompt).not.toContain("adding it to the bag");
    expect(prompt).toContain("at most two short paragraphs");
    expect(prompt).toContain("no debug labels such as \"catalog-backed detail\"");
  });

  it("does not advertise adding items to the bag as an agent capability", () => {
    const englishGreeting = formatTemplate(storeCopy.en.agent.greeting, { product: "Atelier Wool Coat" });
    const arabicGreeting = formatTemplate(storeCopy.ar.agent.greeting, { product: "Atelier Wool Coat" });

    expect(englishGreeting).not.toMatch(/bag|cart/i);
    expect(arabicGreeting).not.toContain("السلة");
  });

  it("always routes shopper answers through a live LLM even when a legacy mode value is present", () => {
    const previous = {
      mode: process.env.AGENT_MODE,
      openrouterKey: process.env.OPENROUTER_API_KEY,
      deepseekKey: process.env.DEEPSEEK_API_KEY,
    };
    process.env.AGENT_MODE = "legacy-local";
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    expect(getModelConfig().mode).toBe("live");

    restoreEnv("AGENT_MODE", previous.mode);
    restoreEnv("OPENROUTER_API_KEY", previous.openrouterKey);
    restoreEnv("DEEPSEEK_API_KEY", previous.deepseekKey);
  });

  it("sends trusted server-side conversation history to the live model", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Atelier Wool Coat in Camel is the warmer option we were discussing." } }],
          usage: { prompt_tokens: 120, completion_tokens: 20, total_tokens: 140 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(
      demoProducts[0],
      "Which color would you choose?",
      undefined,
      undefined,
      [
        { role: "user", content: "I need something warm for work." },
        { role: "assistant", content: "The Atelier Wool Coat is designed for colder days." },
      ],
    );

    expect(answer.mode).toBe("live");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { messages: Array<{ role: string; content: string }> };
    expect(body.messages.slice(-3)).toEqual([
      { role: "user", content: "I need something warm for work." },
      { role: "assistant", content: "The Atelier Wool Coat is designed for colder days." },
      { role: "user", content: "Which color would you choose?" },
    ]);

    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("blocks unsupported live-model output claims after the provider responds", () => {
    const result = evaluateOutputGuardrails("Use code SAVE20 for a special discount today.", "en");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("missing_catalog_field");
  });

  it("scores natural catalog phrasing without requiring punctuation or plural parroting", () => {
    const product = demoProducts.find((item) => item.slug === "high-rise-straight-denim")!;
    const evaluation = evaluateAgentResponse({
      product,
      message: "What about shipping?",
      answer: "Complimentary shipping is available over $150, and you can return the High-Rise Straight Denim within 30 days for free. Would you like to check the sizes?",
      expectedTerms: ["Complimentary shipping", "returns"],
      kind: "known",
    });

    expect(evaluation.hardFailures).toEqual([]);
    expect(evaluation.passed).toBe(true);
  });

  it("falls through OpenRouter provider failures to the DeepSeek live route", async () => {
    const previous = {
      openrouterKey: process.env.OPENROUTER_API_KEY,
      deepseekKey: process.env.DEEPSEEK_API_KEY,
      mode: process.env.AGENT_MODE,
    };
    process.env.AGENT_MODE = "live";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
    const product = demoProducts[0];

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
        .mockResolvedValueOnce(new Response("quota exhausted", { status: 402 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content:
                      "Atelier Wool Coat is a double-faced wool coat with a relaxed silhouette and clean drape. Review the size guide on the product page.",
                  },
                },
              ],
              usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );

    const answer = await generateAgentAnswer(product, "What is special about this product?");

    expect(answer.fallbackReason).toBeUndefined();
    expect(answer.text).toContain("Atelier Wool Coat");
    expect(answer.provider).toBe("deepseek-direct");
    expect(answer.providerRoute).toContain("openrouter(rate_limited)");
    expect(answer.providerRoute).toContain("openrouter(no_credits)");
    expect(answer.providerRoute).toContain("deepseek-direct(ok)");

    restoreEnv("OPENROUTER_API_KEY", previous.openrouterKey);
    restoreEnv("DEEPSEEK_API_KEY", previous.deepseekKey);
    restoreEnv("AGENT_MODE", previous.mode);
  });

  it("returns a model fallback when every live provider times out", async () => {
    const previous = {
      openrouterKey: process.env.OPENROUTER_API_KEY,
      deepseekKey: process.env.DEEPSEEK_API_KEY,
      mode: process.env.AGENT_MODE,
    };
    process.env.AGENT_MODE = "live";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
    const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const answer = await generateAgentAnswer(demoProducts[0], "What is special about this product?");

    expect(answer.fallbackReason).toBe("model_error");
    expect(answer.errorCode).toBe("timeout");
    expect(answer.providerRoute).toContain("openrouter(timeout)");
    expect(answer.providerRoute).toContain("deepseek-direct(timeout)");

    restoreEnv("OPENROUTER_API_KEY", previous.openrouterKey);
    restoreEnv("DEEPSEEK_API_KEY", previous.deepseekKey);
    restoreEnv("AGENT_MODE", previous.mode);
  });

  it("keeps a safe live answer when exact-fact repair cannot improve it", async () => {
    const previous = {
      openrouterKey: process.env.OPENROUTER_API_KEY,
      deepseekKey: process.env.DEEPSEEK_API_KEY,
    };
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    delete process.env.DEEPSEEK_API_KEY;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Atelier Wool Coat is a practical option for cold-weather layering." } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )),
    );

    const answer = await generateAgentAnswer(demoProducts[0], "Is this warm enough for winter?");

    expect(answer.fallbackReason).toBeUndefined();
    expect(answer.mode).toBe("live");
    expect(answer.text).toContain("Atelier Wool Coat");
    expect(answer.providerRoute).toContain("catalog_grounding_repair_low_confidence");

    restoreEnv("OPENROUTER_API_KEY", previous.openrouterKey);
    restoreEnv("DEEPSEEK_API_KEY", previous.deepseekKey);
  });
});
