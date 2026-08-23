import type { CatalogProvider, CatalogProviderConnection, CatalogSyncResult } from "@/lib/catalog/provider";
import { currentZidCredentials, fetchZidJson } from "@/lib/integrations/zid-client";
import type { CatalogProduct, Merchant } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

const MAX_POSTGRES_INTEGER = 2_147_483_647;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function localized(value: unknown, language: "ar" | "en", fallback = ""): string {
  const item = record(value);
  return text(item[language] ?? item[language === "ar" ? "en" : "ar"] ?? value, fallback);
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inventoryCount(value: unknown, fallback = 0): number {
  return Math.min(MAX_POSTGRES_INTEGER, Math.max(0, Math.trunc(number(value, fallback))));
}

function plainText(value: unknown): string {
  const candidate = typeof value === "object" && value ? localized(value, "en", localized(value, "ar")) : text(value);
  return candidate.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 12_000);
}

function imageUrl(value: unknown): string {
  const image = record(value);
  return text(image.url ?? image.image_url ?? image.original ?? image.full_size ?? value, "/placeholder.svg");
}

function optionValues(value: unknown): string[] {
  return array(value).map((item) => {
    const option = record(item);
    return localized(option.name ?? option.value ?? option, "en", localized(option.name ?? option.value ?? option, "ar"));
  }).filter(Boolean);
}

export class ZidCatalogProvider implements CatalogProvider {
  provider = "zid" as const;
  isConnected = false;
  manifest = {
    provider: this.provider,
    displayName: "Zid",
    production: true,
    supportsOAuth: true,
    supportsWebhooks: true,
    supportsIncrementalSync: true,
    requiredScopes: ["account.read", "products.read", "third_webhook_write", "third_js_write"],
    environmentVariables: ["ZID_CLIENT_ID", "ZID_CLIENT_SECRET", "ZID_REDIRECT_URI"],
    documentationUrl: "https://docs.zid.sa/",
  } as const;

  getMerchant(): Merchant | null { return null; }
  listProducts(): CatalogProduct[] { return []; }
  getProductBySlug(): CatalogProduct | null { return null; }
  getProductById(): CatalogProduct | null { return null; }
  getRelatedProducts(): CatalogProduct[] { return []; }

  normalizeProduct(payload: unknown): CatalogProduct | null {
    const item = record(payload);
    const id = text(item.id);
    const englishName = localized(item.name, "en");
    const arabicName = localized(item.name, "ar", englishName);
    const name = englishName || arabicName;
    if (!id || !name) return null;
    const regularPrice = number(item.price);
    const salePrice = item.sale_price == null ? regularPrice : number(item.sale_price, regularPrice);
    const stockQuantity = array(item.stocks).reduce<number>(
      (total, stock) => inventoryCount(total + inventoryCount(record(stock).available_quantity)),
      0,
    );
    const quantity = inventoryCount(item.quantity, stockQuantity);
    const options = array(item.options).map((value) => {
      const option = record(value);
      return {
        name: localized(option.name, "en", localized(option.name, "ar", "Option")),
        values: optionValues(option.values ?? option.choices),
      };
    }).filter((option) => option.values.length > 0);
    const categories = array(item.categories).map((value) => localized(record(value).name ?? value, "en", localized(record(value).name ?? value, "ar"))).filter(Boolean);
    const description = plainText(item.description ?? item.short_description);
    const shortDescription = plainText(item.short_description ?? item.description).slice(0, 600);
    const image = imageUrl(array(item.images)[0]);
    const published = item.is_published !== false && item.is_draft !== true;
    const inStock = item.is_infinite === true || quantity > 0;
    return {
      id: `zid-${id}`,
      externalId: id,
      platform: "zid",
      slug: `zid-${id}`,
      name,
      arabicName,
      category: categories[0] || "Uncategorized",
      tagline: "",
      shortDescription,
      longDescription: description,
      priceSar: salePrice,
      compareAtPriceSar: regularPrice > salePrice ? regularPrice : null,
      currency: text(item.currency, "SAR"),
      availability: published && inStock ? "In stock" : published ? "Out of stock" : "Unavailable",
      inventory: item.is_infinite === true ? MAX_POSTGRES_INTEGER : quantity,
      variants: options,
      sizes: options.find((option) => /size|مقاس/i.test(option.name))?.values ?? [],
      colors: options.find((option) => /color|لون/i.test(option.name))?.values ?? [],
      material: "",
      sizeGuide: [],
      keyFeatures: array(item.attributes).map((value) => plainText(record(value).value ?? value)).filter(Boolean),
      specs: [],
      careShippingNotes: "",
      faqs: [],
      objections: [],
      weakDescriptionSignals: description ? [] : ["missing_description"],
      imagePath: image,
      tags: array(item.keywords).map((value) => text(value)).filter(Boolean),
      persona: "",
      upsellProductSlugs: [],
      crossSellProductSlugs: [],
    };
  }

  async syncCatalog(connection: CatalogProviderConnection, cursor?: string | null): Promise<CatalogSyncResult> {
    if (!connection.externalStoreId) throw new Error("The Zid connection is missing its store identity.");
    const credentials = await currentZidCredentials(connection.credentialRef, connection.persistCredentialRef);
    const page = Math.max(1, Number(cursor) || 1);
    const url = new URL("https://api.zid.sa/v1/products/");
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");
    url.searchParams.set("extended", "true");
    url.searchParams.set("ordering", "created_at");
    url.searchParams.set("deleted", "false");
    const payload = record(await fetchZidJson(credentials, connection.externalStoreId, url, {}, connection.persistCredentialRef));
    const products = array(payload.results ?? record(payload.data).results ?? payload.data)
      .map((item) => this.normalizeProduct(item))
      .filter((item): item is CatalogProduct => Boolean(item));
    const next = text(payload.next ?? record(payload.data).next);
    return { products, cursor: next ? String(page + 1) : null, complete: !next };
  }
}
