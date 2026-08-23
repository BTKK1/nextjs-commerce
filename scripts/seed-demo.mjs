import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const catalog = JSON.parse(
  await readFile(join(root, "src", "data", "demo-catalog.json"), "utf8")
);
const dbPath = process.env.DEMO_DATA_FILE || join(root, ".local", "demo-db.json");

const now = "2026-07-06T09:00:00.000Z";
const tingPrimaryModel =
  process.env.SALES_AGENT_MODEL ||
  process.env.PRODUCT_AGENT_MODEL ||
  process.env.OPENROUTER_MODEL ||
  "google/gemini-2.5-flash-lite";
const products = catalog.products;
const product = (slug) => {
  const found = products.find((item) => item.slug === slug);
  if (!found) throw new Error(`Missing seed product: ${slug}`);
  return found;
};

const tote = product("everyday-leather-tote");
const coat = product("atelier-wool-coat");
const denim = product("high-rise-straight-denim");

const db = {
  merchants: [catalog.merchant],
  products,
  visitors: [
    { id: "visitor-demo-001", anonymousRef: "anon-atelier-001", firstSeenAt: now, lastSeenAt: now },
    { id: "visitor-demo-002", anonymousRef: "anon-atelier-014", firstSeenAt: now, lastSeenAt: now }
  ],
  conversations: [
    {
      id: "conv-seed-tote",
      merchantId: catalog.merchant.id,
      productId: tote.id,
      productSlug: tote.slug,
      visitorRef: "anon-atelier-001",
      status: "open",
      createdAt: now,
      updatedAt: now,
      fallbackReason: null,
      detectedObjection: "quality_concern"
    },
    {
      id: "conv-seed-coat",
      merchantId: catalog.merchant.id,
      productId: coat.id,
      productSlug: coat.slug,
      visitorRef: "anon-atelier-014",
      status: "open",
      createdAt: now,
      updatedAt: now,
      fallbackReason: "missing_catalog_field",
      detectedObjection: "price_concern"
    }
  ],
  messages: [
    { id: "msg-001", conversationId: "conv-seed-tote", role: "user", content: "Will the tote fit my laptop and daily things?", createdAt: now },
    { id: "msg-002", conversationId: "conv-seed-tote", role: "assistant", content: "Yes. It fits up to a 14-inch laptop, a notebook, and a bottle of water, with two slip pockets inside.", createdAt: now, qualityRating: 5 },
    { id: "msg-003", conversationId: "conv-seed-coat", role: "user", content: "Does the coat include a lifetime warranty?", createdAt: now },
    { id: "msg-004", conversationId: "conv-seed-coat", role: "assistant", content: "I do not have that detail in the current store catalog data. Please ask the merchant or check the product details before buying.", createdAt: now, fallbackReason: "missing_catalog_field", qualityRating: 4 }
  ],
  insights: [
    { id: "insight-001", merchantId: catalog.merchant.id, productId: tote.id, productSlug: tote.slug, type: "repeated_question", category: "capacity", title: "Tote capacity questions", detail: "Shoppers ask whether the tote fits a laptop and daily essentials.", count: 2, createdAt: now, updatedAt: now },
    { id: "insight-002", merchantId: catalog.merchant.id, productId: coat.id, productSlug: coat.slug, type: "objection", category: "price_concern", title: "Coat price concern", detail: "Shoppers compare the Atelier Wool Coat price with basic coats.", count: 1, createdAt: now, updatedAt: now },
    { id: "insight-003", merchantId: catalog.merchant.id, productId: coat.id, productSlug: coat.slug, type: "unknown_answer", category: "missing_catalog_field", title: "Warranty detail missing", detail: "Lifetime warranty terms are not available in the current store catalog data.", count: 1, createdAt: now, updatedAt: now },
    { id: "insight-004", merchantId: catalog.merchant.id, productId: denim.id, productSlug: denim.slug, type: "weak_description", category: "missing_inseam", title: "Inseam details missing", detail: "Exact inseam options are not listed in the demo denim description.", count: 1, createdAt: now, updatedAt: now }
  ],
  insightSources: [
    { id: "source-001", insightId: "insight-001", conversationId: "conv-seed-tote", messageId: "msg-001", createdAt: now },
    { id: "source-002", insightId: "insight-002", conversationId: "conv-seed-coat", messageId: "msg-003", createdAt: now },
    { id: "source-003", insightId: "insight-003", conversationId: "conv-seed-coat", messageId: "msg-004", createdAt: now }
  ],
  dashboardSettings: [
    { id: "settings-maison-vert-demo", merchantId: catalog.merchant.id, agentTone: "neutral_saudi", retentionDays: 90, demoMode: true, updatedAt: now }
  ],
  guardrails: [
    { id: "guardrail-allowed-topics", merchantId: catalog.merchant.id, name: "Allowed product topics", enabled: true, description: "Current product, catalog comparisons, sizes, colors, visible price, availability, care, material, fit, and gift suitability." },
    { id: "guardrail-blocked-claims", merchantId: catalog.merchant.id, name: "Unsupported claims", enabled: true, description: "No unsupported delivery, discounts, warranty, medical/legal claims, credentials, or personal data collection." }
  ],
  platformIntegrations: [
    { id: "integration-demo", merchantId: catalog.merchant.id, provider: "demo_catalog", status: "connected", connectedAt: now, notes: "Maison Vert sample catalog provider used for the demo." },
    { id: "integration-salla", merchantId: catalog.merchant.id, provider: "salla", status: "not_connected_demo", connectedAt: null, notes: "Future adapter stub only. No Salla calls are made." },
    { id: "integration-zid", merchantId: catalog.merchant.id, provider: "zid", status: "not_connected_demo", connectedAt: null, notes: "Future adapter stub only. No Zid calls are made." }
  ],
  syncJobs: [
    { id: "sync-demo-seed", merchantId: catalog.merchant.id, provider: "demo_catalog", status: "completed", startedAt: now, finishedAt: now, notes: "Seeded local Maison Vert catalog." }
  ],
  webhookEvents: [],
  configVersions: [
    { id: "config-v1", merchantId: catalog.merchant.id, version: 1, model: tingPrimaryModel, mode: "live", createdAt: now }
  ],
  auditLogs: [
    { id: "audit-seed", merchantId: catalog.merchant.id, action: "seed_demo", actor: "system", createdAt: now, detail: "Local Maison Vert demo database seeded without external platform calls." }
  ],
  events: [
    { id: "event-001", merchantId: catalog.merchant.id, productId: tote.id, productSlug: tote.slug, visitorRef: "anon-atelier-001", type: "product_page_view", createdAt: now },
    { id: "event-002", merchantId: catalog.merchant.id, productId: tote.id, productSlug: tote.slug, visitorRef: "anon-atelier-001", type: "conversation_started", createdAt: now },
    { id: "event-003", merchantId: catalog.merchant.id, productId: coat.id, productSlug: coat.slug, visitorRef: "anon-atelier-014", type: "fallback_triggered", createdAt: now }
  ]
};

await mkdir(dirname(dbPath), { recursive: true });
await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
console.log(`Seeded demo database at ${dbPath}`);
