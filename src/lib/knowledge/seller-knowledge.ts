import { getCatalogProvider } from "@/lib/catalog";
import { loadDatabase } from "@/lib/storage/json-store";
import type {
  DashboardSettings,
  DemoDatabase,
  DemoProduct,
  Guardrail,
  Merchant,
  PlatformIntegration,
  PlatformProvider,
} from "@/lib/types";

export interface SellerKnowledgeContext {
  source: "dashboard_database" | "platform_provider";
  provider: PlatformProvider;
  merchant: Merchant;
  currentProduct: DemoProduct;
  relatedProducts: DemoProduct[];
  productsCount: number;
  settings?: DashboardSettings;
  guardrails: Guardrail[];
  integrations: PlatformIntegration[];
}

function connectedProvider(db: DemoDatabase): PlatformProvider {
  return db.platformIntegrations.find((item) => item.status === "connected")?.provider ?? "demo_catalog";
}

function relatedFromDashboardProducts(db: DemoDatabase, product: DemoProduct, limit: number): DemoProduct[] {
  const slugs = [...product.upsellProductSlugs, ...product.crossSellProductSlugs];
  return slugs
    .map((slug) => db.products.find((item) => item.slug === slug))
    .filter((item): item is DemoProduct => Boolean(item))
    .slice(0, limit);
}

export function getSellerKnowledgeForProduct(
  slug: string,
  db: DemoDatabase = loadDatabase(),
  limit = 4,
): SellerKnowledgeContext | null {
  const providerName = connectedProvider(db);
  const provider = getCatalogProvider(providerName);
  const dashboardProduct = db.products.find((product) => product.slug === slug) ?? null;
  const providerProduct = provider.getProductBySlug(slug);
  const currentProduct = dashboardProduct ?? providerProduct;
  const merchant = db.merchants[0] ?? provider.getMerchant();

  if (!currentProduct || !merchant) return null;

  const dashboardRelated = relatedFromDashboardProducts(db, currentProduct, limit);
  const providerRelated = provider.getRelatedProducts(currentProduct, limit);

  return {
    source: dashboardProduct ? "dashboard_database" : "platform_provider",
    provider: provider.provider,
    merchant,
    currentProduct,
    relatedProducts: dashboardRelated.length ? dashboardRelated : providerRelated,
    productsCount: db.products.length || provider.listProducts().length,
    settings: db.dashboardSettings.find((item) => item.merchantId === merchant.id),
    guardrails: db.guardrails.filter((item) => item.merchantId === merchant.id && item.enabled),
    integrations: db.platformIntegrations.filter((item) => item.merchantId === merchant.id),
  };
}

export function listSellerProducts(db: DemoDatabase = loadDatabase()): DemoProduct[] {
  if (db.products.length) return db.products;
  return getCatalogProvider(connectedProvider(db)).listProducts();
}
