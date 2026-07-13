import type { CatalogProvider } from "@/lib/catalog/provider";
import type { DemoProduct, Merchant } from "@/lib/types";

export class SallaCatalogProvider implements CatalogProvider {
  provider = "salla" as const;
  isConnected = false;

  getMerchant(): Merchant | null {
    return null;
  }

  listProducts(): DemoProduct[] {
    return [];
  }

  getProductBySlug(): DemoProduct | null {
    return null;
  }

  getProductById(): DemoProduct | null {
    return null;
  }

  getRelatedProducts(): DemoProduct[] {
    return [];
  }
}
