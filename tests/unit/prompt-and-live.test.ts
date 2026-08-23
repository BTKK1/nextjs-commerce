import { afterEach, describe, expect, it, vi } from "vitest";
import { demoProducts } from "@/data/catalog";
import { formatTemplate, storeCopy } from "@/components/saleh-demo/store-i18n";
import { evaluateOutputGuardrails } from "@/lib/agent/guardrails";
import { evaluateAgentResponse } from "@/lib/agent/evaluator";
import { areAgentAnswersNearDuplicates, estimateAgentTokenReservation, generateAgentAnswer, limitAnswerToOneQuestion } from "@/lib/agent/llm-client";
import { applyFallbackExperience } from "@/lib/agent/chat-service";
import type { RuntimeAgentConfig } from "@/lib/agent/config-repository";
import { buildAgentSystemPrompt, buildProductContext } from "@/lib/agent/prompt-builder";
import { DEFAULT_AGENT_SYSTEM_PROMPT, NON_REMOVABLE_AGENT_GUARDRAILS } from "@/lib/agent/default-prompt";
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
    vi.unstubAllEnvs();
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

    expect(prompt).toContain("Answer only from verified product, catalog, store, and merchant context");
    expect(prompt).toContain("You are Nbeh (نبيه)");
    expect(prompt).toContain("Nbeh is the assistant identity; Maison Vert is the merchant");
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
    expect(prompt).toContain("Do not claim to add products to cart or checkout");
    expect(prompt).not.toContain("adding it to the bag");
    expect(prompt).toContain("more than two short paragraphs");
    expect(prompt).toContain("Use no Markdown, bullets, debug labels");
  });

  it("keeps the client Nbeh persona and sales behavior non-removable", () => {
    for (const prompt of [DEFAULT_AGENT_SYSTEM_PROMPT, NON_REMOVABLE_AGENT_GUARDRAILS]) {
      expect(prompt).toContain("Nbeh");
      expect(prompt).toContain("نبيه");
      expect(prompt).toMatch(/merchant\/store name remains separate context|store, merchant context/);
      expect(prompt).toMatch(/one or two short/);
      expect(prompt).toMatch(/at most one question|not ask more than one useful question/);
      expect(prompt).toMatch(/Do not force a question|never force a question/);
      expect(prompt).toMatch(/Do not invent|Never invent/);
      expect(prompt).toMatch(/explicit yes or no/);
      expect(prompt).toMatch(/exceeds a verified (maximum|limit)/);
      expect(prompt).toMatch(/never imply (?:that )?(?:the product fits|a known mismatch is suitable)/);
    }

    expect(DEFAULT_AGENT_SYSTEM_PROMPT).toContain("white Saudi Arabic");
    expect(DEFAULT_AGENT_SYSTEM_PROMPT).toContain("عزيزي العميل");
    expect(DEFAULT_AGENT_SYSTEM_PROMPT).toContain("يسعدنا خدمتك");
    expect(DEFAULT_AGENT_SYSTEM_PROMPT).toContain("must buy");
    expect(DEFAULT_AGENT_SYSTEM_PROMPT).toContain("do not miss out");
    expect(DEFAULT_AGENT_SYSTEM_PROMPT).toContain("A missing gift box or wrapping detail does not make gift suitability itself unknown");
    expect(NON_REMOVABLE_AGENT_GUARDRAILS).toContain("Treat gift suitability separately from gift packaging");
    expect(NON_REMOVABLE_AGENT_GUARDRAILS).toContain("never force a question, CTA, or sale");
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

  it("uses the deterministic provider only behind the explicit non-production test flag", async () => {
    const previous = {
      testProvider: process.env.AGENT_TEST_PROVIDER,
    };
    vi.stubEnv("NODE_ENV", "test");
    process.env.AGENT_TEST_PROVIDER = "deterministic";

    const answer = await generateAgentAnswer(demoProducts[0], "What is the price?");

    expect(answer.text).toContain("$489");
    expect(answer.model).toBe("deterministic-test-provider");
    expect(answer.providerRoute).toBe("deterministic-test-provider(ok)");

    restoreEnv("AGENT_TEST_PROVIDER", previous.testProvider);
  });

  it("never enables the deterministic test provider in production", async () => {
    const previous = {
      testProvider: process.env.AGENT_TEST_PROVIDER,
      openrouterKey: process.env.OPENROUTER_API_KEY,
      deepseekKey: process.env.DEEPSEEK_API_KEY,
    };
    vi.stubEnv("NODE_ENV", "production");
    process.env.AGENT_TEST_PROVIDER = "deterministic";
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    const answer = await generateAgentAnswer(demoProducts[0], "What is the price?");

    expect(answer.model).not.toBe("deterministic-test-provider");
    expect(answer.providerRoute).not.toContain("deterministic-test-provider");
    expect(answer.fallbackReason).toBe("model_error");
    expect(answer.errorCode).toBe("not_configured");

    restoreEnv("AGENT_TEST_PROVIDER", previous.testProvider);
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
    expect(body.messages.slice(-4)).toEqual([
      { role: "user", content: "I need something warm for work." },
      { role: "assistant", content: "The Atelier Wool Coat is designed for colder days." },
      { role: "system", content: "Mandatory current-turn language: Reply in concise, natural English. Do not answer this turn in Arabic." },
      { role: "user", content: "Which color would you choose?" },
    ]);

    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("detects repeated follow-up answers without flagging unrelated replies", () => {
    expect(areAgentAnswersNearDuplicates(
      "It fits a 14-inch laptop, notebook, and daily essentials for work.",
      "It fits a 14-inch laptop, a notebook, and your daily work essentials.",
    )).toBe(true);
    expect(areAgentAnswersNearDuplicates(
      "Camel is the most versatile color for work.",
      "The listed price is $320.",
    )).toBe(false);
  });

  it("reserves against the real prompt, history, output, and one repair pass", () => {
    process.env.DEMO_PERSISTENCE = "memory";
    resetDatabaseForTests(createSeedDatabase());
    const product = demoProducts[0];
    const knowledge = getSellerKnowledgeForProduct(product.slug)!;
    const estimate = estimateAgentTokenReservation(
      product,
      "Which color fits the work use I mentioned?",
      undefined,
      knowledge,
      [
        { role: "user", content: "I need a warm coat for office commuting." },
        { role: "assistant", content: "The wool and cashmere blend is intended for cold-weather layering." },
      ],
    );
    expect(estimate).toBeGreaterThan(4_000);
    expect(estimate).toBeLessThanOrEqual(50_000);
  });

  it("repairs a wrong Arabic currency while preserving the catalog currency", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "pleated-linen-trouser")!;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "سعره 210 ريال." } }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "سعره $210، وإذا يهمك الكتان الطبيعي فهو خامته الأساسية." } }], usage: { prompt_tokens: 120, completion_tokens: 16, total_tokens: 136 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "كم سعره وهل يستاهل؟");

    expect(answer.text).toContain("$210");
    expect(answer.text).not.toContain("ريال");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body)) as { messages: Array<{ role: string; content: string }> };
    expect(repairBody.messages.at(-2)?.content).toContain("white Saudi Arabic");
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("deterministically adds acknowledgement and decision help when a price objection stays robotic", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "atelier-wool-coat")!;
    const weakAnswer = "The Atelier Wool Coat is $489. The price reflects the double-faced wool and cashmere blend, cupro lining, and Italian weaving.";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: weakAnswer } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "It feels expensive.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(answer.text).toContain("$489");
    expect(answer.text).toMatch(/^I get why/i);
    expect(answer.text).toContain("double-faced wool and cashmere blend");
    expect(answer.text).toContain("may not be the right buy");
    expect(answer.providerRoute).toContain("objection_guidance_guardrail");
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("does not mistake suitability wording for physical sizing", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "everyday-leather-tote")!;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Yes—its listed capacity includes a 14-inch laptop, notebook, and daily essentials, so it fits that work use." } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "Is this a fit for carrying documents to work?");

    expect(answer.fallbackReason).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("keeps the useful Arabic purchase-intent answer after removing a redundant greeting", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "high-rise-straight-denim")!;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "أهلًا بك، هذا هو بنطلون High-Rise Straight Denim بقصة مستقيمة وخصر مرتفع. إذا تبي رأيي، خيار عملي للاستخدام اليومي." } }],
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "ابي بنطلون");

    expect(answer.fallbackReason).toBeUndefined();
    expect(answer.text).toContain("High-Rise Straight Denim");
    expect(answer.text).not.toMatch(/^أهل|^ًا بك/);
    expect(answer.providerRoute).not.toContain("output_guardrail");
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("keeps the useful answer and joins extra follow-up questions into one", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "high-rise-straight-denim")!;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "هذا بنطلون High-Rise Straight Denim بقصة مستقيمة وخصر مرتفع. تبيه للاستخدام اليومي؟ ووش مقاسك المعتاد؟" } }],
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "ابي بنطلون");

    expect(answer.fallbackReason).toBeUndefined();
    expect(answer.text).toContain("High-Rise Straight Denim");
    expect(answer.text.match(/[؟?]/g)).toHaveLength(1);
    expect(answer.providerRoute).toContain("question_limit_guardrail");
    expect(limitAnswerToOneQuestion("وش استخدامك؟ ووش مقاسك؟", "ar")).toBe("وش استخدامك، ووش مقاسك؟");
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("uses the configured fallback and escalates after a prior fallback", () => {
    const config = {
      guardrails: [{ fallback_response_ar: "هالمعلومة مو واضحة عندي حاليًا." }],
    } as RuntimeAgentConfig;
    const answer = applyFallbackExperience(
      { text: "ignored", fallbackReason: "low_confidence", confidence: 0.2, mode: "live", language: "ar" },
      config,
      [
        { role: "assistant", content: "هلا! أنا نبيه." },
        { role: "user", content: "أبي بنطلون" },
        { role: "assistant", content: "رد احتياطي", fallbackReason: "low_confidence" },
      ],
      "ar",
      "Atelier Wool Coat",
    );

    expect(answer.text).toContain("هالمعلومة مو واضحة عندي حاليًا.");
    expect(answer.text).toContain("Atelier Wool Coat");
    expect(answer.text).not.toBe("هالمعلومة مو واضحة عندي حاليًا.");
  });

  it("repairs a numerical compatibility mismatch into an explicit rejection", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "everyday-leather-tote")!;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "It fits laptops up to 14 inches." } }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "No—it only fits laptops up to 14 inches, so it will not fit a 15-inch laptop." } }],
        usage: { prompt_tokens: 120, completion_tokens: 20, total_tokens: 140 },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "Will it fit my 15-inch laptop?");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(answer.text).toMatch(/^No\b/i);
    expect(answer.text).toMatch(/14 inches/i);
    expect(answer.text).not.toMatch(/^Yes\b/i);
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("fails closed to a factual Arabic rejection when a repair stays ambiguous", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "everyday-leather-tote")!;
    const ambiguous = "يشيل لابتوب حتى 14 إنش.";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: ambiguous } }],
      usage: { prompt_tokens: 100, completion_tokens: 12, total_tokens: 112 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "هل يناسب لابتوب ١٥ إنش؟");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(answer.text).toMatch(/^لا[،,]/);
    expect(answer.text).toContain("14 إنش");
    expect(answer.text).toContain("15 إنش");
    expect(answer.providerRoute).toContain("compatibility_guardrail");
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("makes one targeted repair when a follow-up repeats the prior answer", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "everyday-leather-tote")!;
    const repeated = "It fits a 14-inch laptop, notebook, and daily work essentials.";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: repeated } }], usage: { prompt_tokens: 100, completion_tokens: 15, total_tokens: 115 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "For a daily commute, the zip-top closure is the useful difference; the trade-off is that the catalog does not give the tote's empty weight." } }], usage: { prompt_tokens: 120, completion_tokens: 28, total_tokens: 148 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "What about using it for a daily commute?", undefined, undefined, [
      { role: "user", content: "Will it hold my office items?" },
      { role: "assistant", content: repeated },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(answer.text).toContain("daily commute");
    expect(areAgentAnswersNearDuplicates(answer.text, repeated)).toBe(false);
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("never turns repeated purchase intent into a low-confidence wall", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "high-rise-straight-denim")!;
    const repeated = "تمام، تقدر تختار المقاس المناسب وتكمل الطلب من الصفحة.";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: repeated } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAgentAnswer(product, "ابي اشتري", undefined, undefined, [
      { role: "user", content: "كيف أطلبه؟" },
      { role: "assistant", content: repeated },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(answer.fallbackReason).toBeUndefined();
    expect(answer.text).toContain("إضافة للسلة");
    expect(answer.providerRoute).toContain("purchase_intent_guardrail");
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("keeps price comparisons as objections instead of overriding them as checkout intent", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "everyday-leather-tote")!;
    const modelAnswer = "I understand the price concern. Its full-grain leather and zip-top closure are the practical differences; if those do not matter for your use, a cheaper option may suit you better.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: modelAnswer } }],
      usage: { prompt_tokens: 100, completion_tokens: 28, total_tokens: 128 },
    }), { status: 200 })));

    const answer = await generateAgentAnswer(product, "It feels expensive. Why should I buy this instead of a cheaper option?");

    expect(answer.detectedObjection).toBe("price_concern");
    expect(answer.text).toContain("feels expensive");
    expect(answer.text).toContain("$320");
    expect(answer.text).toContain("Tuscan leather");
    expect(answer.text).not.toContain("Add to cart");
    expect(answer.providerRoute).not.toContain("purchase_intent_guardrail");
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("normalizes the common Arabic linen misspelling with Unicode-aware boundaries", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const product = demoProducts.find((item) => item.slug === "pleated-linen-trouser")!;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "البنطلون مصنوع من 100% كتن إيرلندي متوسط الوزن، مع طيات أمامية مزدوجة." } }],
      usage: { prompt_tokens: 100, completion_tokens: 24, total_tokens: 124 },
    }), { status: 200 })));

    const answer = await generateAgentAnswer(product, "وش مميزاته؟");

    expect(answer.text).toContain("كتان إيرلندي");
    expect(answer.text).not.toContain("كتن إيرلندي");
    restoreEnv("OPENROUTER_API_KEY", previousKey);
  });

  it("fails quality scoring for wrong currency, invented durability, canned greetings, and repeated answers", () => {
    const product = demoProducts.find((item) => item.slug === "pleated-linen-trouser")!;
    const answer = "Welcome! It is 210 SAR and durable enough to last for years.";
    const evaluation = evaluateAgentResponse({
      product,
      message: "It feels expensive. Is it worth it?",
      answer,
      kind: "objection",
      expectedObjection: "price_concern",
      detectedObjection: "price_concern",
      previousAssistantAnswer: answer,
    });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.hardFailures).toEqual(expect.arrayContaining([
      "unsupported_durability_claim",
      "canned_or_repeated_greeting",
      "catalog_price_or_currency_missing",
      "near_duplicate_previous_answer",
    ]));
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
            choices: [{ message: { content: "This piece is a practical option for cold-weather layering." } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )),
    );

    const answer = await generateAgentAnswer(demoProducts[0], "Is this warm enough for winter?");

    expect(answer.fallbackReason).toBeUndefined();
    expect(answer.mode).toBe("live");
    expect(answer.text).toContain("practical option");
    expect(answer.providerRoute).toContain("catalog_grounding_repair_low_confidence");

    restoreEnv("OPENROUTER_API_KEY", previous.openrouterKey);
    restoreEnv("DEEPSEEK_API_KEY", previous.deepseekKey);
  });
});
