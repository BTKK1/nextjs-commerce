"use client";

import { useEffect, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { addDemoBagItem } from "@/lib/demo-bag";
import { formatTemplate, productCopy, storeCopy, type StoreLocale } from "@/components/saleh-demo/store-i18n";
import type { DemoProduct } from "@/lib/types";

interface Props {
  product: DemoProduct;
  size: string;
  color: string;
  locale?: StoreLocale;
  merchantKey: string;
}

function getVisitorRef() {
  const key = "saleh-demo-visitor";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `anon-${crypto.randomUUID().slice(0, 8)}`;
  window.localStorage.setItem(key, created);
  return created;
}

export function AddToCartDemoButton({ product, size, color, locale = "en", merchantKey }: Props) {
  const [added, setAdded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const copy = storeCopy[locale].cart;
  const localizedProduct = productCopy(product, locale);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleClick() {
    addDemoBagItem(product, { size, color });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
    await fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "demo_add_to_cart_clicked",
        merchantKey,
        productSlug: product.slug,
        visitorRef: getVisitorRef(),
        locale
      })
    }).catch(() => undefined);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!hydrated}
      className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#6f5a43] disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-white sm:w-auto"
      title={formatTemplate(copy.addTitle, { product: localizedProduct.name, color, size })}
      data-testid="add-to-cart-demo"
      data-hydrated={hydrated ? "true" : "false"}
    >
      {added ? <Check className="h-5 w-5" aria-hidden="true" /> : <ShoppingBag className="h-5 w-5" aria-hidden="true" />}
      {added ? copy.added : copy.add}
    </button>
  );
}
