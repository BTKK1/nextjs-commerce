"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, PackageCheck, Ruler, Truck, X } from "lucide-react";
import { AddToCartDemoButton } from "@/components/saleh-demo/AddToCartDemoButton";
import { AgentWidget } from "@/components/saleh-demo/AgentWidget";
import { ProductTelemetry } from "@/components/saleh-demo/ProductTelemetry";
import { useStoreLocale } from "@/components/saleh-demo/StoreLocaleProvider";
import { localizeStorePath, productCopy, storeCopy } from "@/components/saleh-demo/store-i18n";
import { formatMoney, formatProductPrice, getRelatedDemoProducts } from "@/data/catalog";
import { addDemoBagItem } from "@/lib/demo-bag";
import type { DemoProduct } from "@/lib/types";

export function DemoProductPage({ product }: { product: DemoProduct }) {
  const router = useRouter();
  const { locale } = useStoreLocale();
  const copy = storeCopy[locale].product;
  const localizedProduct = productCopy(product, locale);
  const sizes = product.sizes?.length ? product.sizes : product.variants.find((variant) => variant.name === "Size")?.values ?? ["One size"];
  const colors = product.colors?.length ? product.colors : product.variants.find((variant) => variant.name === "Color")?.values ?? ["Default"];
  const [size, setSize] = useState(sizes[0]);
  const [color, setColor] = useState(colors[0]);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const relatedProducts = useMemo(() => getRelatedDemoProducts(product, 3), [product]);
  const merchantKey = process.env.NEXT_PUBLIC_DEMO_MERCHANT_KEY ?? "demo-maison-vert";

  function buyNow() {
    addDemoBagItem(product, { size, color });
    router.push(localizeStorePath("/cart", locale));
  }

  return (
    <main className="bg-[#faf8f3] text-ink">
      <ProductTelemetry productSlug={product.slug} merchantKey={merchantKey} />
      <div className="mx-auto max-w-7xl px-4 py-8 xss:px-7.5 md:py-12">
        <Link href={localizeStorePath("/#collection", locale)} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 hover:text-ink">
          <ArrowLeft className={`h-4 w-4 ${locale === "ar" ? "rotate-180" : ""}`} aria-hidden="true" />
          {copy.back}
        </Link>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.82fr)] lg:gap-6">
          <div className="overflow-hidden bg-stone-100">
            <Image
              src={product.imagePath}
              alt={localizedProduct.name}
              width={1000}
              height={1200}
              priority
              sizes="(min-width: 1024px) 54vw, 100vw"
              className="aspect-[5/6] w-full object-cover"
              data-testid="product-image"
              unoptimized
            />
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-stone-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">
                  {localizedProduct.category}
                </span>
                <span className="bg-[#f3ede3] px-2.5 py-1 text-xs font-semibold text-[#6f5a43]">
                  {product.availability} &middot; {product.inventory} {copy.pieces}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink md:text-5xl">{localizedProduct.name}</h1>
              {localizedProduct.tagline ? <p className="mt-3 text-lg italic text-stone-600">{localizedProduct.tagline}</p> : null}
              <div className="mt-6 flex flex-wrap items-end gap-3">
                <span className="text-3xl font-semibold text-ink">{formatProductPrice(product)}</span>
                {product.compareAtPriceSar ? (
                  <span className="pb-1 text-lg text-stone-500 line-through">
                    {formatMoney(product.compareAtPriceSar, product.currency)}
                  </span>
                ) : null}
              </div>

              <p className="mt-6 max-w-xl text-sm leading-7 text-stone-700">{localizedProduct.longDescription}</p>

              <div className="mt-9">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">{copy.color}</p>
                  <p className="text-xs font-semibold text-ink">{color}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" data-testid="color-options">
                  {colors.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      className={`min-h-11 border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                        color === option
                          ? "border-ink bg-ink text-white"
                          : "border-stone-300 text-stone-600 hover:border-ink hover:text-ink"
                      }`}
                      aria-pressed={color === option}
                      aria-label={`${copy.color} ${option}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">{copy.size}</p>
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 underline underline-offset-4 hover:text-ink"
                    data-testid="size-guide-button"
                  >
                    <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                    {copy.sizeGuide}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" data-testid="size-options">
                  {sizes.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSize(option)}
                      className={`min-h-11 min-w-14 border px-4 py-2 text-sm font-semibold tabular-nums transition ${
                        size === option
                          ? "border-ink bg-ink text-white"
                          : "border-stone-300 text-stone-600 hover:border-ink hover:text-ink"
                      }`}
                      aria-pressed={size === option}
                      aria-label={`${copy.size} ${option}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <AddToCartDemoButton product={product} size={size} color={color} locale={locale} merchantKey={merchantKey} />
                <button
                  type="button"
                  onClick={buyNow}
                  className="focus-ring inline-flex w-full items-center justify-center rounded-md border border-ink bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-ink transition hover:bg-ink hover:text-white sm:w-auto"
                  data-testid="buy-now"
                >
                  {copy.buyNow}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.82fr]">
          <div className="border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-ink">{copy.details}</h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-stone-800">{copy.keyDetails}</h3>
                <ul className="mt-3 space-y-3">
                  {product.keyFeatures.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm leading-6 text-stone-700">
                      <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-[#7d623f]" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-stone-800">{copy.specs}</h3>
                <dl className="mt-3 divide-y divide-stone-100">
                  {product.specs.map((spec) => (
                    <div key={spec.label} className="grid grid-cols-[0.72fr_1.28fr] gap-3 py-3 text-sm">
                      <dt className="font-medium text-stone-600">{spec.label}</dt>
                      <dd className="text-stone-800">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          <div className="border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-ink">{copy.careShipping}</h2>
            <div className="mt-4 flex gap-3 text-sm leading-6 text-stone-700">
              <Truck className="mt-1 h-5 w-5 flex-none text-[#7d623f]" aria-hidden="true" />
              <p>{product.careShippingNotes}</p>
            </div>
            <div className="mt-5 flex gap-3 bg-stone-50 p-4 text-sm leading-6 text-stone-700">
              <PackageCheck className="mt-1 h-5 w-5 flex-none text-[#7d623f]" aria-hidden="true" />
              <p>{copy.checkoutNote}</p>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-ink">{copy.faqs}</h2>
            <div className="mt-4 space-y-4">
              {product.faqs.map((faq) => (
                <div key={faq.question} className="border-b border-stone-100 pb-4 last:border-0 last:pb-0">
                  <h3 className="font-semibold text-stone-800">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-ink">{copy.agentQuestions}</h2>
            <div className="mt-4 space-y-4">
              {product.objections.map((objection) => (
                <div key={objection.objection} className="bg-stone-50 p-4">
                  <p className="text-sm font-semibold text-stone-800">{objection.objection}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{objection.response}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">{copy.youMayAlsoLike}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{copy.relatedPieces}</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedProducts.map((related) => (
              <Link key={related.slug} href={localizeStorePath(`/product/${related.slug}`, locale)} className="group bg-white">
                <div className="overflow-hidden bg-stone-100">
                  <Image
                    src={related.imagePath}
                    alt={productCopy(related, locale).name}
                    width={1000}
                    height={1200}
                    sizes="(min-width: 1024px) 30vw, 100vw"
                    className="aspect-[5/6] w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                    unoptimized
                  />
                </div>
                <div className="flex items-baseline justify-between gap-4 p-4">
                  <p className="font-semibold text-ink">{productCopy(related, locale).name}</p>
                  <p className="text-sm tabular-nums text-stone-600">{formatProductPrice(related)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {sizeGuideOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="size-guide-title"
          data-testid="size-guide-dialog"
        >
          <div className="max-h-[90vh] w-full overflow-auto bg-white p-6 shadow-2xl sm:max-w-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">{copy.fitNotes}</p>
                <h2 id="size-guide-title" className="mt-2 text-2xl font-semibold text-ink">
                  {copy.sizeGuide}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                className="rounded-md p-2 text-stone-500 hover:bg-stone-100 hover:text-ink"
                aria-label={copy.closeSizeGuide}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
              {(product.sizeGuide?.length ? product.sizeGuide : sizes.map((item) => ({ label: item, value: "Choose your usual size." }))).map((row) => (
                <div key={row.label} className="grid grid-cols-[92px_1fr] gap-4 py-3 text-sm">
                  <dt className="font-semibold text-ink">{row.label}</dt>
                  <dd className="text-stone-700">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              {copy.sizeGuidance}
            </p>
          </div>
        </div>
      ) : null}
      <AgentWidget
        key={`${locale}-${product.slug}`}
        merchantKey={merchantKey}
        merchantName="Maison Vert"
        productSlug={product.slug}
        productName={localizedProduct.name}
        locale={locale}
      />
    </main>
  );
}
