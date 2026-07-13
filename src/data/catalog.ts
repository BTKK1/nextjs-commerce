import catalog from "@/data/demo-catalog.json";
import type { DemoProduct, Merchant } from "@/lib/types";

export const demoMerchant = catalog.merchant as Merchant;
export const demoProducts = catalog.products as DemoProduct[];

export function getDemoProductBySlug(slug: string): DemoProduct | undefined {
  return demoProducts.find((product) => product.slug === slug);
}

export function getDemoProductById(id: string): DemoProduct | undefined {
  return demoProducts.find((product) => product.id === id);
}

export function getRelatedDemoProducts(product: DemoProduct, limit = 4): DemoProduct[] {
  const relatedSlugs = [...product.upsellProductSlugs, ...product.crossSellProductSlugs];
  return relatedSlugs
    .map((slug) => getDemoProductBySlug(slug))
    .filter((item): item is DemoProduct => Boolean(item))
    .slice(0, limit);
}

export function formatProductPrice(product: Pick<DemoProduct, "priceSar" | "currency">): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(product.priceSar);
}

export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
