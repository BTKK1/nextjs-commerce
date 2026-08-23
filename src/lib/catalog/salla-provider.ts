import type { CatalogProvider, CatalogProviderConnection, CatalogSyncResult } from "@/lib/catalog/provider";
import type { CatalogProduct, Merchant } from "@/lib/types";
import { fetchSallaJson } from "@/lib/integrations/salla-client";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function number(value: unknown, fallback = 0): number {
  const candidate = record(value).amount ?? value;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function plainText(value: unknown): string {
  return text(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 12_000);
}

function imageUrl(value: unknown): string {
  const image = record(value);
  return text(image.url || image.original || image.standard || value, "/placeholder.svg");
}

function optionValues(value: unknown): string[] {
  return array(value).map((item) => text(record(item).name || record(item).value || item)).filter(Boolean);
}

export class SallaCatalogProvider implements CatalogProvider {
  provider = "salla" as const;
  isConnected = false;
  manifest = {
    provider: this.provider,
    displayName: "Salla",
    production: true,
    supportsOAuth: true,
    supportsWebhooks: true,
    supportsIncrementalSync: true,
    requiredScopes: ["products.read"],
    environmentVariables: ["SALLA_CLIENT_ID", "SALLA_CLIENT_SECRET", "SALLA_REDIRECT_URI", "SALLA_WEBHOOK_SECRET"],
    documentationUrl: "https://docs.salla.dev/",
  } as const;

  getMerchant(): Merchant | null {
    return null;
  }

  listProducts(): CatalogProduct[] {
    return [];
  }

  getProductBySlug(): CatalogProduct | null {
    return null;
  }

  getProductById(): CatalogProduct | null {
    return null;
  }

  getRelatedProducts(): CatalogProduct[] {
    return [];
  }

  normalizeProduct(payload: unknown): CatalogProduct | null {
    const item = record(payload);
    const id = text(item.id);
    const name = text(item.name);
    if (!id || !name) return null;
    const salePrice = number(item.sale_price, number(item.price));
    const regularPrice = number(item.regular_price, salePrice);
    const quantity = Number(item.quantity);
    const options = array(item.options).map((value) => {
      const option = record(value);
      return { name: text(option.name, "Option"), values: optionValues(option.values) };
    }).filter((option) => option.values.length > 0);
    const categories = array(item.categories).map((value) => text(record(value).name || value)).filter(Boolean);
    const description = plainText(item.description || item.short_description);
    const status = text(item.status).toLowerCase();
    const image = imageUrl(item.main_image || item.thumbnail || array(item.images)[0]);
    return {
      id: `salla-${id}`,
      externalId: id,
      platform: "salla",
      slug: `salla-${id}`,
      name,
      arabicName: name,
      category: categories[0] || "Uncategorized",
      tagline: plainText(item.subtitle),
      shortDescription: plainText(item.short_description || description).slice(0, 600),
      longDescription: description,
      priceSar: salePrice,
      compareAtPriceSar: regularPrice > salePrice ? regularPrice : null,
      currency: text(record(item.price).currency || item.currency, "SAR"),
      availability: status === "sale" || status === "active" || status === "available" ? "In stock" : status || "Unknown",
      inventory: Number.isFinite(quantity) ? quantity : 0,
      variants: options,
      sizes: options.find((option) => /size|مقاس/i.test(option.name))?.values ?? [],
      colors: options.find((option) => /color|لون/i.test(option.name))?.values ?? [],
      material: "",
      sizeGuide: [],
      keyFeatures: array(item.features).map((value) => plainText(record(value).value || value)).filter(Boolean),
      specs: [],
      careShippingNotes: "",
      faqs: [],
      objections: [],
      weakDescriptionSignals: description ? [] : ["missing_description"],
      imagePath: image,
      tags: array(item.tags).map((value) => text(record(value).name || value)).filter(Boolean),
      persona: "",
      upsellProductSlugs: [],
      crossSellProductSlugs: [],
    };
  }

  async syncCatalog(connection: CatalogProviderConnection, cursor?: string | null): Promise<CatalogSyncResult> {
    const page = Math.max(1, Number(cursor) || 1);
    const url = new URL("https://api.salla.dev/admin/v2/products");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "60");
    const payload = record(await fetchSallaJson(connection.credentialRef, url, {}, connection.persistCredentialRef));
    const products = array(payload.data).map((item) => this.normalizeProduct(item)).filter((item): item is CatalogProduct => Boolean(item));
    const pagination = record(payload.pagination);
    const currentPage = number(pagination.currentPage || pagination.current_page, page);
    const totalPages = number(pagination.totalPages || pagination.total_pages, currentPage);
    const complete = currentPage >= totalPages;
    return { products, cursor: complete ? null : String(currentPage + 1), complete };
  }
}
