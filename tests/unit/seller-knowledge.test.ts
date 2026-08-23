import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "@/lib/agent/prompt-builder";
import { getSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { resetDatabaseForTests } from "@/lib/storage/json-store";
import { createSeedDatabase } from "@/lib/storage/seed";

describe("seller knowledge provider", () => {
  it("uses dashboard database product knowledge instead of forcing the seed catalog", () => {
    process.env.DEMO_PERSISTENCE = "memory";
    const db = createSeedDatabase();
    const product = db.products.find((item) => item.slug === "atelier-wool-coat");
    expect(product).toBeTruthy();

    product!.priceSar = 777;
    product!.keyFeatures = ["Dashboard-only alpaca lining", ...product!.keyFeatures];
    product!.careShippingNotes = "Dashboard knowledge: ships after merchant confirmation.";
    db.guardrails.push({
      id: "guardrail-dashboard-test",
      merchantId: db.merchants[0].id,
      name: "Dashboard source test",
      enabled: true,
      description: "Answers must come from the seller dashboard knowledgebase.",
    });
    resetDatabaseForTests(db);

    const knowledge = getSellerKnowledgeForProduct("atelier-wool-coat");
    expect(knowledge).toBeTruthy();
    expect(knowledge!.source).toBe("dashboard_database");
    expect(knowledge!.currentProduct.priceSar).toBe(777);
    expect(knowledge!.currentProduct.keyFeatures[0]).toBe("Dashboard-only alpaca lining");
    expect(knowledge!.guardrails.map((item) => item.description)).toContain(
      "Answers must come from the seller dashboard knowledgebase.",
    );

    const prompt = buildAgentSystemPrompt(knowledge!.currentProduct, undefined, knowledge!);
    expect(prompt).toContain("777");
    expect(prompt).toContain("Dashboard-only alpaca lining");
    expect(prompt).toContain("Dashboard knowledge: ships after merchant confirmation.");
    expect(prompt).toContain("Answer only from verified product, catalog, store, and merchant context");
  });
});
