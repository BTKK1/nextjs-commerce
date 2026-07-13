import type { DemoProduct } from "@/lib/types";

export interface DemoBagItem {
  productSlug: string;
  productId: string;
  name: string;
  price: number;
  currency: string;
  imagePath: string;
  size: string;
  color: string;
  quantity: number;
}

export const DEMO_BAG_STORAGE_KEY = "maison-vert-bag";
export const DEMO_BAG_EVENT = "maison-vert-bag-updated";

function itemKey(item: Pick<DemoBagItem, "productSlug" | "size" | "color">) {
  return `${item.productSlug}::${item.size}::${item.color}`;
}

export function readDemoBag(): DemoBagItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEMO_BAG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeDemoBag(items: DemoBagItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_BAG_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(DEMO_BAG_EVENT));
}

export function addDemoBagItem(product: DemoProduct, selection: { size: string; color: string; quantity?: number }) {
  const quantity = selection.quantity ?? 1;
  const nextItem: DemoBagItem = {
    productSlug: product.slug,
    productId: product.id,
    name: product.name,
    price: product.priceSar,
    currency: product.currency ?? "USD",
    imagePath: product.imagePath,
    size: selection.size,
    color: selection.color,
    quantity,
  };
  const items = readDemoBag();
  const existingIndex = items.findIndex((item) => itemKey(item) === itemKey(nextItem));
  if (existingIndex >= 0) {
    items[existingIndex] = {
      ...items[existingIndex],
      quantity: items[existingIndex].quantity + quantity,
    };
    writeDemoBag(items);
    return;
  }
  writeDemoBag([...items, nextItem]);
}

export function setDemoBagQuantity(productSlug: string, size: string, color: string, quantity: number) {
  const next = readDemoBag()
    .map((item) => (itemKey(item) === itemKey({ productSlug, size, color }) ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0);
  writeDemoBag(next);
}

export function removeDemoBagItem(productSlug: string, size: string, color: string) {
  writeDemoBag(readDemoBag().filter((item) => itemKey(item) !== itemKey({ productSlug, size, color })));
}

export function clearDemoBag() {
  writeDemoBag([]);
}

export function getDemoBagCount(items: DemoBagItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function getDemoBagSubtotal(items: DemoBagItem[]) {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}
