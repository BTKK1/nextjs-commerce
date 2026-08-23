import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { demoProducts, getDemoProductBySlug } from "@/data/catalog";
import { demoCatalogProvider, getCatalogProvider } from "@/lib/catalog";
import { ZidCatalogProvider } from "@/lib/catalog/zid-provider";

describe("demo catalog provider", () => {
  it("returns the referenced Maison Vert products", () => {
    const products = demoCatalogProvider.listProducts();
    expect(products.length).toBeGreaterThanOrEqual(8);
    for (const product of products) {
      expect(product.slug).toBeTruthy();
      expect(product.currency).toBe("USD");
      expect(product.priceSar).toBeGreaterThan(0);
      expect(product.variants.length).toBeGreaterThan(0);
      expect(product.sizes?.length).toBeGreaterThan(0);
      expect(product.colors?.length).toBeGreaterThan(0);
      expect(product.sizeGuide?.length).toBeGreaterThan(0);
      expect(product.faqs.length).toBeGreaterThan(0);
      expect(product.objections.length).toBeGreaterThan(0);
    }
  });

  it("finds products by slug and id", () => {
    const product = demoProducts[0];
    expect(demoCatalogProvider.getProductBySlug(product.slug)).toMatchObject({ id: product.id });
    expect(demoCatalogProvider.getProductById(product.id)).toMatchObject({ slug: product.slug });
    expect(getDemoProductBySlug(product.slug)).toMatchObject({ id: product.id });
  });

  it("returns related products from upsell and cross-sell slugs", () => {
    const product = demoProducts[0];
    const related = demoCatalogProvider.getRelatedProducts(product, 10);
    expect(related.map((item) => item.slug)).toEqual([...product.upsellProductSlugs, ...product.crossSellProductSlugs]);
  });

  it("has referenced image files for every product", () => {
    for (const product of demoProducts) {
      const imagePath = path.join(process.cwd(), "public", product.imagePath.replace(/^\//, ""));
      expect(existsSync(imagePath), `${product.imagePath} should exist`).toBe(true);
      expect(product.imagePath).toMatch(/^\/store-products\/.+\.jpg$/);
    }
  });

  it("keeps Salla and Zid as not-connected stubs", () => {
    expect(getCatalogProvider("salla").isConnected).toBe(false);
    expect(getCatalogProvider("zid").isConnected).toBe(false);
    expect(getCatalogProvider("salla").manifest.requiredScopes).toContain("products.read");
    expect(getCatalogProvider("zid").manifest.supportsWebhooks).toBe(true);
    expect(getCatalogProvider("zid").manifest.requiredScopes).toContain("third_js_write");
  });

  it("keeps Zid inventory inside the PostgreSQL integer range", () => {
    const provider = new ZidCatalogProvider();
    const infiniteProduct = provider.normalizeProduct({
      id: 101,
      name: { ar: "منتج غير محدود", en: "Unlimited product" },
      price: 99,
      is_infinite: true,
    });
    const oversizedProduct = provider.normalizeProduct({
      id: 102,
      name: { en: "Oversized inventory" },
      price: 49,
      quantity: Number.MAX_SAFE_INTEGER,
    });

    expect(infiniteProduct?.inventory).toBe(2_147_483_647);
    expect(oversizedProduct?.inventory).toBe(2_147_483_647);
  });
});
