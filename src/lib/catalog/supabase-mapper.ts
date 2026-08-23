import type { CatalogProduct, PlatformProvider } from "@/lib/types";

type Row = Record<string, unknown>;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function platform(value: unknown): PlatformProvider {
  return value === "salla" || value === "zid" ? value : "demo_catalog";
}

export function productFromSupabaseRow(row: Row): CatalogProduct {
  const raw = object(row.raw_platform_payload);
  const attributes = object(row.attributes);
  const guidance = object(row.sales_guidance);
  return {
    ...raw,
    id: text(row.id),
    merchantId: text(row.merchant_id),
    externalId: row.external_id == null ? null : text(row.external_id),
    platform: platform(row.platform),
    slug: text(row.slug),
    name: text(row.name),
    arabicName: text(row.arabic_name, text(row.name)),
    category: text(row.category, "Uncategorized"),
    tagline: text(attributes.tagline),
    shortDescription: text(row.short_description),
    longDescription: text(row.description),
    priceSar: number(row.price),
    compareAtPriceSar: row.compare_at_price == null ? null : number(row.compare_at_price),
    currency: text(row.currency, "SAR"),
    availability: text(row.availability, "Unknown"),
    inventory: number(row.inventory_count),
    variants: array(row.variants) as CatalogProduct["variants"],
    sizes: array(attributes.sizes) as string[],
    colors: array(attributes.colors) as string[],
    material: text(attributes.material),
    sizeGuide: array(attributes.sizeGuide) as CatalogProduct["sizeGuide"],
    keyFeatures: array(attributes.keyFeatures) as string[],
    specs: array(attributes.specs) as CatalogProduct["specs"],
    careShippingNotes: text(attributes.careShippingNotes),
    faqs: array(row.faqs) as CatalogProduct["faqs"],
    objections: array(guidance.objections) as CatalogProduct["objections"],
    weakDescriptionSignals: array(attributes.weakDescriptionSignals) as string[],
    imagePath: text(row.image_url, "/placeholder.svg"),
    tags: array(attributes.tags) as string[],
    persona: text(guidance.persona),
    upsellProductSlugs: array(raw.upsellProductSlugs) as string[],
    crossSellProductSlugs: array(raw.crossSellProductSlugs) as string[],
  };
}

export function catalogProductToSupabaseRow(product: CatalogProduct, merchantId: string, provider: PlatformProvider): Record<string, unknown> {
  return {
    merchant_id: merchantId,
    external_id: product.externalId ?? product.id,
    platform: provider === "demo_catalog" ? "demo" : provider,
    slug: product.slug,
    name: product.name,
    arabic_name: product.arabicName,
    description: product.longDescription,
    short_description: product.shortDescription,
    price: product.priceSar,
    compare_at_price: product.compareAtPriceSar,
    currency: product.currency ?? "SAR",
    image_url: product.imagePath,
    category: product.category,
    availability: product.availability,
    inventory_count: product.inventory,
    variants: product.variants,
    attributes: {
      tagline: product.tagline, sizes: product.sizes, colors: product.colors, material: product.material,
      sizeGuide: product.sizeGuide, keyFeatures: product.keyFeatures, specs: product.specs,
      careShippingNotes: product.careShippingNotes, weakDescriptionSignals: product.weakDescriptionSignals, tags: product.tags,
    },
    faqs: product.faqs,
    sales_guidance: { objections: product.objections, persona: product.persona },
    raw_platform_payload: product,
    updated_at: new Date().toISOString(),
  };
}
