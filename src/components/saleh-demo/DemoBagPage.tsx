"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import {
  DEMO_BAG_EVENT,
  getDemoBagSubtotal,
  readDemoBag,
  removeDemoBagItem,
  setDemoBagQuantity,
  type DemoBagItem,
} from "@/lib/demo-bag";
import { formatMoney } from "@/data/catalog";
import { useEffect, useMemo, useState } from "react";

export function DemoBagPage() {
  const [items, setItems] = useState<DemoBagItem[] | null>(null);

  useEffect(() => {
    const sync = () => setItems(readDemoBag());
    sync();
    window.addEventListener(DEMO_BAG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DEMO_BAG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const bagItems = items ?? [];
  const subtotal = useMemo(() => getDemoBagSubtotal(bagItems), [bagItems]);
  const currency = bagItems[0]?.currency ?? "USD";
  const shipping = subtotal >= 150 || subtotal === 0 ? 0 : 12;
  const total = subtotal + shipping;

  return (
    <main className="min-h-screen bg-[#faf8f3] text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 xss:px-7.5 md:py-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Maison Vert</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink md:text-5xl">Your bag</h1>
          </div>
          <Link href="/#collection" className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7d623f] hover:underline">
            Continue shopping
          </Link>
        </div>

        {items === null ? (
          <section className="mt-14 border-t border-stone-200 pt-14 text-center">
            <p className="text-stone-600">Loading your bag...</p>
          </section>
        ) : items.length === 0 ? (
          <section className="mt-14 border-t border-stone-200 pt-14 text-center">
            <p className="text-stone-600">Nothing here yet.</p>
            <Link
              href="/#collection"
              className="mt-6 inline-flex border-b border-ink pb-1 text-sm font-semibold uppercase tracking-[0.2em] text-ink hover:text-[#7d623f]"
            >
              Discover the collection
            </Link>
          </section>
        ) : (
          <section className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
            <ul className="divide-y divide-stone-200 border-y border-stone-200 bg-white">
              {bagItems.map((item) => (
                <li
                  key={`${item.productSlug}-${item.size}-${item.color}`}
                  className="grid grid-cols-[84px_1fr] gap-4 p-4 sm:grid-cols-[120px_1fr_auto] sm:gap-5 sm:p-6"
                  data-testid="bag-item"
                >
                  <Link href={`/product/${item.productSlug}`} className="block bg-stone-100">
                    <Image
                      src={item.imagePath}
                      alt={item.name}
                      width={200}
                      height={240}
                      className="aspect-[5/6] w-full object-cover"
                      unoptimized
                    />
                  </Link>
                  <div className="flex min-w-0 flex-col justify-between gap-5">
                    <div>
                      <Link href={`/product/${item.productSlug}`} className="text-lg font-semibold text-ink hover:text-[#7d623f]">
                        {item.name}
                      </Link>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                        {item.color} &middot; Size {item.size}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="inline-flex items-center border border-stone-300">
                        <button
                          type="button"
                          onClick={() => setDemoBagQuantity(item.productSlug, item.size, item.color, item.quantity - 1)}
                          className="p-2 text-stone-600 hover:text-ink"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <span className="min-w-8 text-center text-sm tabular-nums" data-testid="bag-item-quantity">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDemoBagQuantity(item.productSlug, item.size, item.color, item.quantity + 1)}
                          className="p-2 text-stone-600 hover:text-ink"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDemoBagItem(item.productSlug, item.size, item.color)}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 hover:text-red-700"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="col-span-2 text-right text-sm font-semibold tabular-nums text-ink sm:col-span-1">
                    {formatMoney(item.price * item.quantity, item.currency)}
                  </p>
                </li>
              ))}
            </ul>

            <aside className="h-fit border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-ink">Summary</h2>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-stone-600">Subtotal</dt>
                  <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-600">Shipping</dt>
                  <dd className="tabular-nums">{shipping === 0 ? "Free" : formatMoney(shipping, currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-4 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums" data-testid="bag-total">{formatMoney(total, currency)}</dd>
                </div>
              </dl>
              <Link
                href="/checkout"
                className="mt-8 block w-full rounded-md bg-ink py-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#6f5a43]"
              >
                Proceed to checkout
              </Link>
              <p className="mt-4 text-center text-xs text-stone-500">Taxes calculated at checkout &middot; Free returns</p>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
