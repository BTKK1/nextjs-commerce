import {
  demoMerchant,
  demoProducts,
  getDemoProductById,
  getDemoProductBySlug,
  getRelatedDemoProducts
} from "@/data/catalog";
import type { CatalogProvider, CatalogProviderConnection, CatalogSyncResult } from "@/lib/catalog/provider";
import type { CatalogProduct, Merchant } from "@/lib/types";

export class DemoCatalogProvider implements CatalogProvider {
  provider = "demo_catalog" as const;
  isConnected = true;
  manifest = {
    provider: this.provider,
    displayName: "Demo Catalog",
    production: false,
    supportsOAuth: false,
    supportsWebhooks: false,
    supportsIncrementalSync: false,
    requiredScopes: ["catalog:read"],
    environmentVariables: [],
    documentationUrl: "/docs/integrations/demo-catalog",
  } as const;

  getMerchant(): Merchant {
    return demoMerchant;
  }

  listProducts(): CatalogProduct[] {
    return demoProducts;
  }

  getProductBySlug(slug: string): CatalogProduct | null {
    return getDemoProductBySlug(slug) ?? null;
  }

  getProductById(id: string): CatalogProduct | null {
    return getDemoProductById(id) ?? null;
  }

  getRelatedProducts(product: CatalogProduct, limit = 4): CatalogProduct[] {
    return getRelatedDemoProducts(product, limit);
  }

  normalizeProduct(payload: unknown): CatalogProduct | null {
    if (!payload || typeof payload !== "object") return null;
    const candidate = payload as Partial<CatalogProduct>;
    if (!candidate.id || !candidate.slug || !candidate.name) return null;
    return candidate as CatalogProduct;
  }

  async syncCatalog(_connection: CatalogProviderConnection): Promise<CatalogSyncResult> {
    return { products: demoProducts, cursor: null, complete: true };
  }
}
