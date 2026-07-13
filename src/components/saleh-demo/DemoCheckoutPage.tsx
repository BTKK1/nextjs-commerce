"use client";

import Link from "next/link";
import { Check, Lock } from "lucide-react";
import {
  clearDemoBag,
  getDemoBagSubtotal,
  readDemoBag,
  type DemoBagItem,
} from "@/lib/demo-bag";
import { formatMoney } from "@/data/catalog";
import { FormEvent, useEffect, useMemo, useState } from "react";

export function DemoCheckoutPage() {
  const [items, setItems] = useState<DemoBagItem[] | null>(null);
  const [placed, setPlaced] = useState<{ number: string; email: string } | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(readDemoBag()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const checkoutItems = items ?? [];
  const subtotal = useMemo(() => getDemoBagSubtotal(checkoutItems), [checkoutItems]);
  const currency = checkoutItems[0]?.currency ?? "USD";
  const shipping = subtotal >= 150 || subtotal === 0 ? 0 : 12;
  const tax = Math.round(subtotal * 0.08);
  const total = subtotal + shipping + tax;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = `MV-${Math.floor(100000 + Math.random() * 900000)}`;
    clearDemoBag();
    setItems([]);
    setPlaced({ number, email });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (placed) {
    return (
      <main className="min-h-screen bg-[#faf8f3] px-4 py-20 text-center text-ink">
        <div className="mx-auto max-w-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white">
            <Check className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-8 text-4xl font-semibold md:text-5xl">Thank you.</h1>
          <p className="mt-4 text-stone-600">
            Order <span className="font-semibold tabular-nums text-ink">{placed.number}</span> is confirmed.
            A demo receipt is on its way to <span className="text-ink">{placed.email}</span>.
          </p>
          <Link href="/#collection" className="mt-10 inline-flex border-b border-ink pb-1 text-sm font-semibold uppercase tracking-[0.2em] hover:text-[#7d623f]">
            Continue shopping
          </Link>
        </div>
      </main>
    );
  }

  if (items === null) {
    return (
      <main className="min-h-screen bg-[#faf8f3] px-4 py-20 text-center text-ink">
        <h1 className="text-4xl font-semibold">Loading checkout</h1>
        <p className="mt-3 text-stone-600">Checking your local bag...</p>
      </main>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <main className="min-h-screen bg-[#faf8f3] px-4 py-20 text-center text-ink">
        <h1 className="text-4xl font-semibold">Your bag is empty</h1>
        <p className="mt-3 text-stone-600">Add something you love before checking out.</p>
        <Link href="/#collection" className="mt-8 inline-flex border-b border-ink pb-1 text-sm font-semibold uppercase tracking-[0.2em] hover:text-[#7d623f]">
          Browse the collection
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f3] text-ink">
      <div className="mx-auto max-w-6xl px-4 py-12 xss:px-7.5">
        <h1 className="text-4xl font-semibold md:text-5xl">Checkout</h1>

        <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Contact</h2>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                  className="mt-2 w-full border-b border-stone-300 bg-transparent py-3 outline-none focus:border-ink"
                />
              </label>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Shipping address</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="First name" required />
                <Field label="Last name" required />
              </div>
              <Field label="Address" required />
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="City" required />
                <Field label="Postal code" required />
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Country</span>
                  <select className="mt-2 w-full border-b border-stone-300 bg-transparent py-3 outline-none focus:border-ink" defaultValue="United States">
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>France</option>
                    <option>Germany</option>
                    <option>Japan</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Payment</h2>
              <p className="flex items-center gap-2 text-xs text-stone-500">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Secure payment demo. No card is charged.
              </p>
              <Field label="Card number" placeholder="4242 4242 4242 4242" required />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Expiry (MM/YY)" placeholder="12/28" required />
                <Field label="CVC" placeholder="123" required />
              </div>
            </section>

            <button
              type="submit"
              className="w-full rounded-md bg-ink py-4 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#6f5a43]"
              data-testid="place-order"
            >
              Place order &middot; {formatMoney(total, currency)}
            </button>
          </div>

          <aside className="h-fit border border-stone-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-2xl font-semibold">Order</h2>
            <ul className="mt-6 space-y-4">
              {checkoutItems.map((item) => (
                <li key={`${item.productSlug}-${item.size}-${item.color}`} className="flex justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                      {item.color} &middot; {item.size} &middot; Qty {item.quantity}
                    </p>
                  </div>
                  <p className="tabular-nums">{formatMoney(item.price * item.quantity, item.currency)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-8 space-y-3 border-t border-stone-200 pt-6 text-sm">
              <Row label="Subtotal" value={formatMoney(subtotal, currency)} />
              <Row label="Shipping" value={shipping === 0 ? "Free" : formatMoney(shipping, currency)} />
              <Row label="Tax (est.)" value={formatMoney(tax, currency)} />
              <div className="flex justify-between border-t border-stone-200 pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(total, currency)}</dd>
              </div>
            </dl>
          </aside>
        </form>
      </div>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</span>
      <input {...inputProps} className="mt-2 w-full border-b border-stone-300 bg-transparent py-3 outline-none placeholder:text-stone-400 focus:border-ink" />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-600">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
