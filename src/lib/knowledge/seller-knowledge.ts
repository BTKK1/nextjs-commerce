import { getCatalogProvider } from "@/lib/catalog";
import { productFromSupabaseRow } from "@/lib/catalog/supabase-mapper";
import { resolveDataBackend } from "@/lib/backend/mode";
import { loadDatabase } from "@/lib/storage/json-store";
import { DEMO_MERCHANT_ID } from "@/lib/supabase/constants";
import { createServiceClient, hasSupabaseServiceConfig } from "@/utils/supabase/server";
import { findSallaInstallation } from "@/lib/integrations/salla-store";
import { SERVING_COMMERCE_INTEGRATION_STATUSES } from "@/lib/integrations/serving-status";
import type {
  DashboardSettings,
  DemoDatabase,
  DemoProduct,
  Guardrail,
  Merchant,
  PlatformIntegration,
  PlatformProvider,
} from "@/lib/types";
import { parseWidgetPreferences } from "@/lib/widget/preferences";

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

function connectedProvider(db: DemoDatabase, merchantId?: string): PlatformProvider {
  return db.platformIntegrations.find((item) => item.status === "connected" && (!merchantId || item.merchantId === merchantId))?.provider ?? "demo_catalog";
}

function relatedFromDashboardProducts(db: DemoDatabase, product: DemoProduct, merchantId: string, limit: number): DemoProduct[] {
  const slugs = [...product.upsellProductSlugs, ...product.crossSellProductSlugs];
  return slugs
    .map((slug) => db.products.find((item) => item.slug === slug && (!item.merchantId || item.merchantId === merchantId)))
    .filter((item): item is DemoProduct => Boolean(item))
    .slice(0, limit);
}

export function getSellerKnowledgeForProduct(
  slug: string,
  db: DemoDatabase = loadDatabase(),
  limit = 4,
  merchantKey?: string,
): SellerKnowledgeContext | null {
  const selectedMerchant = merchantKey
    ? db.merchants.find((item) => item.publicKey === merchantKey || item.id === merchantKey)
    : db.merchants[0];
  if (!selectedMerchant) return null;
  const providerName = connectedProvider(db, selectedMerchant.id);
  const provider = getCatalogProvider(providerName);
  const isLegacyDemoMerchant = selectedMerchant.id === db.merchants[0]?.id;
  const dashboardProduct = db.products.find((product) => product.slug === slug && (product.merchantId === selectedMerchant.id || (isLegacyDemoMerchant && !product.merchantId))) ?? null;
  const providerProduct = provider.getProductBySlug(slug);
  const currentProduct = dashboardProduct ?? providerProduct;
  const merchant = selectedMerchant ?? provider.getMerchant();

  if (!currentProduct || !merchant) return null;

  const dashboardRelated = relatedFromDashboardProducts(db, currentProduct, selectedMerchant.id, limit);
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function items(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function value(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function retryRuntimeQuery<T>(operation: () => PromiseLike<{ data: T; error: unknown }>, attempts = 3): Promise<{ data: T; error: unknown }> {
  let result = await operation();
  for (let attempt = 1; result.error && attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    result = await operation();
  }
  return result;
}

export async function loadSellerKnowledgeForProduct(
  slug: string,
  merchantKey?: string,
  limit = 4,
): Promise<SellerKnowledgeContext | null> {
  if (resolveDataBackend() === "local") {
    if (merchantKey) {
      const installation = await findSallaInstallation(merchantKey);
      if (installation) {
        const currentProduct = installation.products.find((product) => product.slug === slug || product.externalId === slug);
        if (!currentProduct) return null;
        return {
          source: "dashboard_database",
          provider: "salla",
          merchant: {
            id: installation.merchantId,
            publicKey: installation.merchantPublicKey,
            name: installation.merchantName,
            arabicName: installation.merchantName,
            industry: "Ecommerce",
            city: "",
            demoMode: false,
          },
          currentProduct,
          relatedProducts: installation.products.filter((product) => product.slug !== currentProduct.slug).slice(0, limit),
          productsCount: installation.products.length,
          guardrails: [],
          integrations: [{
            id: `salla-integration-${installation.storeId}`,
            merchantId: installation.merchantId,
            provider: "salla",
            status: "connected",
            connectedAt: installation.connectedAt,
            notes: "Connected through Salla Easy Mode.",
            externalStoreId: installation.storeId,
            lastSyncedAt: installation.lastSyncedAt,
          }],
        };
      }
    }
    return getSellerKnowledgeForProduct(slug, loadDatabase(), limit, merchantKey);
  }
  if (!hasSupabaseServiceConfig()) {
    throw new Error("Supabase catalog persistence is selected but its server credentials are not configured.");
  }
  if (!merchantKey && process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  const supabase = createServiceClient();
  let merchantResult = await retryRuntimeQuery(() => {
    let merchantQuery = supabase.from("merchants").select("*").eq("status", "active");
    merchantQuery = merchantKey ? merchantQuery.eq("public_key", merchantKey) : merchantQuery.eq("id", DEMO_MERCHANT_ID);
    return merchantQuery.maybeSingle();
  });
  if (merchantKey && !merchantResult.data && !merchantResult.error) {
    const integrationResult = await retryRuntimeQuery(() => supabase.from("platform_integrations").select("merchant_id").in("provider", ["salla", "zid"]).eq("external_store_id", merchantKey).in("status", [...SERVING_COMMERCE_INTEGRATION_STATUSES]).limit(1).maybeSingle());
    if (integrationResult.error) throw integrationResult.error;
    const integrationMerchantId = integrationResult.data?.merchant_id;
    if (integrationMerchantId) {
      merchantResult = await retryRuntimeQuery(() => supabase.from("merchants").select("*").eq("id", integrationMerchantId).eq("status", "active").maybeSingle());
    }
  }
  const { data: merchantRow, error: merchantError } = merchantResult;
  if (merchantError) throw merchantError;
  if (!merchantRow) return null;

  let productResult = await retryRuntimeQuery(() => supabase.from("products").select("*").eq("merchant_id", merchantRow.id).eq("slug", slug).maybeSingle());
  if (!productResult.data && !productResult.error) {
    productResult = await retryRuntimeQuery(() => supabase.from("products").select("*").eq("merchant_id", merchantRow.id).eq("external_id", slug).maybeSingle());
  }
  const [productsResult, settingsResult, guardrailsResult, integrationsResult] = await Promise.all([
    retryRuntimeQuery(() => supabase.from("products").select("*").eq("merchant_id", merchantRow.id)),
    retryRuntimeQuery(() => supabase.from("dashboard_settings").select("*").eq("merchant_id", merchantRow.id).maybeSingle()),
    retryRuntimeQuery(() => supabase.from("guardrails").select("*").eq("merchant_id", merchantRow.id)),
    retryRuntimeQuery(() => supabase.from("platform_integrations").select("*").eq("merchant_id", merchantRow.id)),
  ]);
  if (productResult.error) throw productResult.error;
  if (productsResult.error) throw productsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (guardrailsResult.error) throw guardrailsResult.error;
  if (integrationsResult.error) throw integrationsResult.error;
  if (!productResult.data) return null;
  const currentProduct = productFromSupabaseRow(productResult.data);
  const products = (productsResult.data ?? []).map(productFromSupabaseRow);
  const relatedSlugs = [...currentProduct.upsellProductSlugs, ...currentProduct.crossSellProductSlugs];
  const relatedProducts = relatedSlugs.map((relatedSlug) => products.find((product) => product.slug === relatedSlug)).filter((product): product is DemoProduct => Boolean(product)).slice(0, limit);
  const preferences = record(settingsResult.data?.dashboard_preferences);
  const widgetPreferences = parseWidgetPreferences(preferences);
  const integrations: PlatformIntegration[] = (integrationsResult.data ?? []).map((row) => ({
    id: value(row.id), merchantId: value(merchantRow.id), provider: (row.provider === "demo" ? "demo_catalog" : row.provider) as PlatformProvider,
    status: (row.status === "not_connected" ? "not_connected_demo" : row.status) as PlatformIntegration["status"], connectedAt: row.connected_at ? value(row.connected_at) : null,
    notes: value(record(row.metadata_json).note), scopes: items(row.scopes).filter((scope): scope is string => typeof scope === "string"),
    externalStoreId: row.external_store_id ? value(row.external_store_id) : null, lastSyncedAt: row.last_synced_at ? value(row.last_synced_at) : null,
  }));

  return {
    source: "dashboard_database",
    provider: currentProduct.platform ?? integrations.find((integration) => integration.status === "connected")?.provider ?? "demo_catalog",
    merchant: {
      id: value(merchantRow.id), publicKey: value(merchantRow.public_key), name: value(merchantRow.display_name, value(merchantRow.business_name, "Merchant")),
      arabicName: value(merchantRow.display_name, value(merchantRow.business_name, "Merchant")), industry: "Ecommerce", city: "", demoMode: merchantRow.platform_type === "demo",
    },
    currentProduct,
    relatedProducts,
    productsCount: products.length,
    settings: settingsResult.data ? { id: value(settingsResult.data.id), merchantId: value(merchantRow.id), agentTone: "neutral_saudi", retentionDays: Number(preferences.retention_days ?? 90), demoMode: Boolean(preferences.demo_mode), updatedAt: value(settingsResult.data.updated_at), refreshInterval: value(settingsResult.data.refresh_interval, "manual"), widgetPositionAr: widgetPreferences.positionAr, widgetPositionEn: widgetPreferences.positionEn, widgetAutoPopupEnabled: widgetPreferences.autoPopupEnabled, widgetAutoPopupDelaySeconds: widgetPreferences.autoPopupDelaySeconds } : undefined,
    guardrails: (guardrailsResult.data ?? []).map((row) => ({ id: value(row.id), merchantId: value(merchantRow.id), name: "Code-enforced catalog safety", enabled: true, description: [...items(row.blocked_topics), ...items(row.blocked_claims)].join(", ") })),
    integrations,
  };
}

export function listSellerProducts(db: DemoDatabase = loadDatabase()): DemoProduct[] {
  if (db.products.length) return db.products;
  return getCatalogProvider(connectedProvider(db, db.merchants[0]?.id)).listProducts();
}
