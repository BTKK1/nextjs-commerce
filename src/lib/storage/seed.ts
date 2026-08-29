import { demoMerchant, demoProducts } from "@/data/catalog";
import type { DemoDatabase, DemoProduct } from "@/lib/types";

const seedTime = "2026-07-06T09:00:00.000Z";
const tingPrimaryModel =
  process.env.SALES_AGENT_MODEL ||
  process.env.PRODUCT_AGENT_MODEL ||
  process.env.OPENROUTER_MODEL ||
  "z-ai/glm-5.3-flash";
const seedAgentMode = "live";

function product(slug: string): DemoProduct {
  const found = demoProducts.find((item) => item.slug === slug);
  if (!found) throw new Error(`Missing seed product: ${slug}`);
  return found;
}

export function createSeedDatabase(): DemoDatabase {
  const tote = product("everyday-leather-tote");
  const coat = product("atelier-wool-coat");
  const denim = product("high-rise-straight-denim");

  return {
    merchants: [demoMerchant],
    products: demoProducts,
    visitors: [
      { id: "visitor-demo-001", anonymousRef: "anon-atelier-001", firstSeenAt: seedTime, lastSeenAt: seedTime },
      { id: "visitor-demo-002", anonymousRef: "anon-atelier-014", firstSeenAt: seedTime, lastSeenAt: seedTime }
    ],
    conversations: [
      {
        id: "conv-seed-tote",
        merchantId: demoMerchant.id,
        productId: tote.id,
        productSlug: tote.slug,
        visitorRef: "anon-atelier-001",
        status: "open",
        createdAt: seedTime,
        updatedAt: seedTime,
        fallbackReason: null,
        detectedObjection: "quality_concern"
      },
      {
        id: "conv-seed-coat",
        merchantId: demoMerchant.id,
        productId: coat.id,
        productSlug: coat.slug,
        visitorRef: "anon-atelier-014",
        status: "open",
        createdAt: seedTime,
        updatedAt: seedTime,
        fallbackReason: "missing_catalog_field",
        detectedObjection: "price_concern"
      }
    ],
    messages: [
      {
        id: "msg-001",
        conversationId: "conv-seed-tote",
        role: "user",
        content: "Will the tote fit my laptop and daily things?",
        createdAt: seedTime
      },
      {
        id: "msg-002",
        conversationId: "conv-seed-tote",
        role: "assistant",
        content: "Yes. It fits up to a 14-inch laptop, a notebook, and a bottle of water, with two slip pockets inside.",
        createdAt: seedTime,
        qualityRating: 5
      },
      {
        id: "msg-003",
        conversationId: "conv-seed-coat",
        role: "user",
        content: "Does the coat include a lifetime warranty?",
        createdAt: seedTime
      },
      {
        id: "msg-004",
        conversationId: "conv-seed-coat",
        role: "assistant",
        content: "I do not have that detail in the current store catalog data. Please ask the merchant or check the product details before buying.",
        createdAt: seedTime,
        fallbackReason: "missing_catalog_field",
        qualityRating: 4
      }
    ],
    insights: [
      {
        id: "insight-001",
        merchantId: demoMerchant.id,
        productId: tote.id,
        productSlug: tote.slug,
        type: "repeated_question",
        category: "capacity",
        title: "Tote capacity questions",
        detail: "Shoppers ask whether the tote fits a laptop and daily essentials.",
        count: 2,
        createdAt: seedTime,
        updatedAt: seedTime
      },
      {
        id: "insight-002",
        merchantId: demoMerchant.id,
        productId: coat.id,
        productSlug: coat.slug,
        type: "objection",
        category: "price_concern",
        title: "Coat price concern",
        detail: "Shoppers compare the Atelier Wool Coat price with basic coats.",
        count: 1,
        createdAt: seedTime,
        updatedAt: seedTime
      },
      {
        id: "insight-003",
        merchantId: demoMerchant.id,
        productId: coat.id,
        productSlug: coat.slug,
        type: "unknown_answer",
        category: "missing_catalog_field",
        title: "Warranty detail missing",
        detail: "Lifetime warranty terms are not available in the current store catalog data.",
        count: 1,
        createdAt: seedTime,
        updatedAt: seedTime
      },
      {
        id: "insight-004",
        merchantId: demoMerchant.id,
        productId: denim.id,
        productSlug: denim.slug,
        type: "weak_description",
        category: "missing_inseam",
        title: "Inseam details missing",
        detail: "Exact inseam options are not listed in the demo denim description.",
        count: 1,
        createdAt: seedTime,
        updatedAt: seedTime
      }
    ],
    insightSources: [
      { id: "source-001", insightId: "insight-001", conversationId: "conv-seed-tote", messageId: "msg-001", createdAt: seedTime },
      { id: "source-002", insightId: "insight-002", conversationId: "conv-seed-coat", messageId: "msg-003", createdAt: seedTime },
      { id: "source-003", insightId: "insight-003", conversationId: "conv-seed-coat", messageId: "msg-004", createdAt: seedTime }
    ],
    dashboardSettings: [
      {
        id: "settings-maison-vert-demo",
        merchantId: demoMerchant.id,
        agentTone: "neutral_saudi",
        retentionDays: 90,
        demoMode: true,
        updatedAt: seedTime,
        widgetOnboardingMessageAr: "هلا! أنا نبيه، مساعد المبيعات هنا. اسألني عن {product} وبساعدك تعرف إذا يناسبك.",
        widgetOnboardingMessageEn: "Hi, I’m Nbeh, the in-store sales assistant. Ask me anything about {product} and I’ll help you decide if it fits what you need.",
        widgetPositionAr: "left",
        widgetPositionEn: "right",
        widgetAutoPopupEnabled: true,
        widgetAutoPopupDelaySeconds: 3
      }
    ],
    guardrails: [
      {
        id: "guardrail-allowed-topics",
        merchantId: demoMerchant.id,
        name: "Nbeh grounded product topics",
        enabled: true,
        description: "Nbeh may use only Maison Vert product, catalog, merchant, and shopper-provided facts: current product, catalog comparisons, sizes, colors, visible price, availability, care, material, fit, and gift suitability."
      },
      {
        id: "guardrail-blocked-claims",
        merchantId: demoMerchant.id,
        name: "Nbeh persona and claim safety",
        enabled: true,
        description: "Nbeh is the assistant; Maison Vert remains the merchant. Use direct, concise, natural white Saudi Arabic; ask at most one useful question only when needed; never force a CTA or sale; avoid formal stock phrases and aggressive selling; never invent delivery, discounts, warranty, product facts, merchant policies, credentials, or personal data."
      }
    ],
    platformIntegrations: [
      {
        id: "integration-demo",
        merchantId: demoMerchant.id,
        provider: "demo_catalog",
        status: "connected",
        connectedAt: seedTime,
        notes: "Maison Vert sample catalog provider used for the demo."
      },
      {
        id: "integration-salla",
        merchantId: demoMerchant.id,
        provider: "salla",
        status: "not_connected_demo",
        connectedAt: null,
        notes: "Future adapter stub only. No Salla calls are made."
      },
      {
        id: "integration-zid",
        merchantId: demoMerchant.id,
        provider: "zid",
        status: "not_connected_demo",
        connectedAt: null,
        notes: "Future adapter stub only. No Zid calls are made."
      }
    ],
    syncJobs: [
      {
        id: "sync-demo-seed",
        merchantId: demoMerchant.id,
        provider: "demo_catalog",
        status: "completed",
        startedAt: seedTime,
        finishedAt: seedTime,
        notes: "Seeded local Maison Vert catalog."
      }
    ],
    webhookEvents: [],
    configVersions: [
      {
        id: "config-v1",
        merchantId: demoMerchant.id,
        version: 1,
        model: tingPrimaryModel,
        mode: seedAgentMode,
        createdAt: seedTime
      }
    ],
    auditLogs: [
      {
        id: "audit-seed",
        merchantId: demoMerchant.id,
        action: "seed_demo",
        actor: "system",
        createdAt: seedTime,
        detail: "Local Maison Vert demo database seeded without external platform calls."
      }
    ],
    events: [
      {
        id: "event-001",
        merchantId: demoMerchant.id,
        productId: tote.id,
        productSlug: tote.slug,
        visitorRef: "anon-atelier-001",
        type: "product_page_view",
        createdAt: seedTime
      },
      {
        id: "event-002",
        merchantId: demoMerchant.id,
        productId: tote.id,
        productSlug: tote.slug,
        visitorRef: "anon-atelier-001",
        type: "conversation_started",
        createdAt: seedTime
      },
      {
        id: "event-003",
        merchantId: demoMerchant.id,
        productId: coat.id,
        productSlug: coat.slug,
        visitorRef: "anon-atelier-014",
        type: "fallback_triggered",
        createdAt: seedTime
      }
    ]
  };
}
