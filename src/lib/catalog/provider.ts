import type { DemoProduct, Merchant, PlatformProvider } from "@/lib/types";

export interface CatalogProvider {
  provider: PlatformProvider;
  isConnected: boolean;
  getMerchant(): Merchant | null;
  listProducts(): DemoProduct[];
  getProductBySlug(slug: string): DemoProduct | null;
  getProductById(id: string): DemoProduct | null;
  getRelatedProducts(product: DemoProduct, limit?: number): DemoProduct[];
}
