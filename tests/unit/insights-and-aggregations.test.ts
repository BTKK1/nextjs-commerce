import { describe, expect, it } from "vitest";
import { demoMerchant, demoProducts } from "@/data/catalog";
import { getDashboardOverview } from "@/lib/dashboard/aggregation";
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
  });

  it("detects weak description signals for missing warranty and delivery data", () => {
    const product = demoProducts[2];
    expect(detectWeakDescriptionSignal(product, "هل عليها ضمان؟")).toBe("missing_warranty");
    expect(detectWeakDescriptionSignal(product, "Can it arrive tomorrow?")).toBe("missing_delivery_estimate");
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
});
