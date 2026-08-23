import type { CatalogProduct, Merchant, PlatformProvider } from "@/lib/types";

export interface CatalogProviderManifest {
  provider: PlatformProvider;
  displayName: string;
  production: boolean;
  supportsOAuth: boolean;
  supportsWebhooks: boolean;
  supportsIncrementalSync: boolean;
  requiredScopes: readonly string[];
  environmentVariables: readonly string[];
  documentationUrl: string;
}

export interface CatalogProviderConnection {
  merchantId: string;
  integrationId: string;
  externalStoreId?: string | null;
  credentialRef?: string | null;
  metadata?: Record<string, unknown>;
  persistCredentialRef?: (credentialRef: string) => Promise<void>;
}

export interface CatalogSyncResult {
  products: CatalogProduct[];
  cursor: string | null;
  complete: boolean;
}

export interface CatalogProvider {
  readonly provider: PlatformProvider;
  readonly isConnected: boolean;
  readonly manifest: CatalogProviderManifest;
  getMerchant(): Merchant | null;
  listProducts(): CatalogProduct[];
  getProductBySlug(slug: string): CatalogProduct | null;
  getProductById(id: string): CatalogProduct | null;
  getRelatedProducts(product: CatalogProduct, limit?: number): CatalogProduct[];
  normalizeProduct(payload: unknown): CatalogProduct | null;
  syncCatalog(connection: CatalogProviderConnection, cursor?: string | null): Promise<CatalogSyncResult>;
}
