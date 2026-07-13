import {
  demoMerchant,
  demoProducts,
  getDemoProductById,
  getDemoProductBySlug,
  getRelatedDemoProducts
} from "@/data/catalog";
import type { CatalogProvider } from "@/lib/catalog/provider";
import type { DemoProduct, Merchant } from "@/lib/types";

export class DemoCatalogProvider implements CatalogProvider {
  provider = "demo_catalog" as const;
  isConnected = true;

  getMerchant(): Merchant {
    return demoMerchant;
  }

  listProducts(): DemoProduct[] {
    return demoProducts;
  }

  getProductBySlug(slug: string): DemoProduct | null {
    return getDemoProductBySlug(slug) ?? null;
  }

  getProductById(id: string): DemoProduct | null {
    return getDemoProductById(id) ?? null;
  }

  getRelatedProducts(product: DemoProduct, limit = 4): DemoProduct[] {
    return getRelatedDemoProducts(product, limit);
  }
}
