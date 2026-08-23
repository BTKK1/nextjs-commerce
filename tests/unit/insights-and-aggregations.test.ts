import { describe, expect, it } from "vitest";
import { demoMerchant, demoProducts } from "@/data/catalog";
import { calculateTokenWallet, getDashboardOverview } from "@/lib/dashboard/aggregation";
import {
  classifyQuestionIntent,
  detectObjection,
  detectWeakDescriptionSignal,
  extractInsightsForMessage,
  normalizeQuestion,
} from "@/lib/insights/extractor";
import { createSeedDatabase } from "@/lib/storage/seed";

describe("insight extraction and dashboard aggregation", () => {
  it("normalizes and classifies shopper questions", () => {
    expect(normalizeQuestion("Is it WORTH the price?!")).toBe("is it worth the price");
    expect(classifyQuestionIntent("هل يناسب كهدية؟")).toBe("gift");
    expect(detectObjection("This feels expensive")).toBe("price_concern");
    expect(classifyQuestionIntent("ابي بنطلون")).toBe("general");
    expect(detectObjection("ابي بنطلون")).toBeUndefined();
    expect(detectObjection("وش اللون؟")).toBe("variant_confusion");
  });

  it("detects weak description signals for missing warranty and delivery data", () => {
    const product = demoProducts[2];
    expect(detectWeakDescriptionSignal(product, "هل عليها ضمان؟")).toBe("missing_warranty");
    expect(detectWeakDescriptionSignal(product, "Can it arrive tomorrow?")).toBe("missing_delivery_estimate");
  });

  it("tags only shopper questions that match a known product-copy gap", () => {
    const tote = demoProducts.find((product) => product.slug === "everyday-leather-tote")!;
    const trouser = demoProducts.find((product) => product.slug === "pleated-linen-trouser")!;
    const scarf = demoProducts.find((product) => product.slug === "silk-square-scarf")!;

    expect(detectWeakDescriptionSignal(tote, "What is the price?")).toBeUndefined();
    expect(detectWeakDescriptionSignal(tote, "What are the exact tote dimensions?")).toContain("dimensions");
    expect(detectWeakDescriptionSignal(trouser, "What is the exact inseam length?")).toContain("inseam");
    expect(detectWeakDescriptionSignal(scarf, "Is this suitable for a gift?")).toBeUndefined();
    expect(detectWeakDescriptionSignal(scarf, "Do you provide gift wrapping?")).toContain("gift packaging");
  });

  it("creates repeated, objection, weak-description, and unknown-answer insights", () => {
    const db = createSeedDatabase();
    const product = demoProducts[0];
    db.conversations.push({
      id: "conv-test",
      merchantId: demoMerchant.id,
      productId: product.id,
      productSlug: product.slug,
      visitorRef: "anon-test",
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    db.messages.push(
      {
        id: "msg-prior",
        conversationId: "conv-test",
        role: "user",
        content: "Can it arrive tomorrow and is it worth the price?",
        createdAt: new Date().toISOString(),
      },
      {
        id: "msg-current",
        conversationId: "conv-test",
        role: "user",
        content: "Can it arrive tomorrow and is it worth the price?",
        createdAt: new Date().toISOString(),
      },
    );

    const insights = extractInsightsForMessage({
      db,
      product,
      conversationId: "conv-test",
      userMessageId: "msg-current",
      userMessage: "Can it arrive tomorrow and is it worth the price?",
      fallbackReason: "missing_catalog_field",
    });

    expect(insights.some((insight) => insight.type === "objection")).toBe(true);
    expect(insights.some((insight) => insight.type === "unknown_answer")).toBe(true);
    expect(insights.some((insight) => insight.type === "weak_description")).toBe(true);
    expect(insights.some((insight) => insight.type === "repeated_question")).toBe(true);
  });

  it("calculates dashboard metrics from seeded data", () => {
    const overview = getDashboardOverview(createSeedDatabase());
    expect(overview.kpis.productPageViews).toBeGreaterThan(0);
    expect(overview.kpis.conversationStarts).toBeGreaterThan(0);
    expect(overview.kpis.totalMessages).toBeGreaterThan(0);
    expect(overview.kpis.unknownAnswerRate).toBeGreaterThan(0);
  });

  it("builds the token wallet from recorded assistant usage and real model rates", () => {
    const db = createSeedDatabase();
    db.messages = [
      {
        id: "usage-1",
        conversationId: "conv-1",
        role: "assistant",
        content: "Answer",
        createdAt: "2026-08-20T12:00:00.000Z",
        model: "google/gemini-2.5-flash-lite",
        provider: "openrouter",
        tokenUsage: { prompt: 1_000, completion: 100, total: 1_100 },
      },
      {
        id: "usage-2",
        conversationId: "conv-1",
        role: "assistant",
        content: "Answer",
        createdAt: "2026-08-21T12:00:00.000Z",
        model: "custom-model",
        provider: "openrouter",
        tokenUsage: { prompt: 300, completion: 100, total: 400, estimated_cost_usd: 0.01 },
      },
      {
        id: "usage-user",
        conversationId: "conv-1",
        role: "user",
        content: "Question",
        createdAt: "2026-08-21T12:00:00.000Z",
        tokenUsage: { total: 9_999 },
      },
    ];

    const wallet = calculateTokenWallet(db, new Date("2026-08-22T10:00:00.000Z"), 10_000);
    expect(wallet.consumedThisCycle).toBe(1_500);
    expect(wallet.remainingThisCycle).toBe(8_500);
    expect(wallet.last7DaysConsumed).toBe(1_500);
    expect(wallet.dailyBurnRate).toBe(214);
    expect(wallet.estimatedCostUsdThisCycle).toBe(0.01014);
    expect(wallet.costCoveragePercent).toBe(100);
  });
});
