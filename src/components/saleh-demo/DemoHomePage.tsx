"use client";

import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/saleh-demo/ProductCard";
import { useStoreLocale } from "@/components/saleh-demo/StoreLocaleProvider";
import { localizeStorePath, productCopy, storeCopy } from "@/components/saleh-demo/store-i18n";
import { demoProducts, formatProductPrice } from "@/data/catalog";

export function DemoHomePage() {
  const { locale } = useStoreLocale();
  const copy = storeCopy[locale].home;
  const featured = demoProducts.slice(0, 3);

  return (
    <main className="bg-[#faf8f3] text-ink">
      <section className="relative">
        <div className="grid gap-0 md:grid-cols-12">
          <div className="flex flex-col justify-center px-4 py-14 xss:px-7.5 md:col-span-5 md:py-24 lg:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">{copy.eyebrow}</p>
            <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-[1.05] text-ink md:text-6xl lg:text-7xl">
              {copy.headline}
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-stone-600">{copy.intro}</p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link
                href="#collection"
                className="border-b border-ink pb-1 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-[#7d623f] hover:text-[#7d623f]"
              >
                {copy.shopCta}
              </Link>
              <Link href="#story" className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500 hover:text-ink">
                {copy.storyCta}
              </Link>
            </div>
          </div>
          <div className="md:col-span-7">
            <Image
              src="/store-products/hero.jpg"
              alt="Model wearing a camel wool coat from the Maison Vert collection"
              width={1600}
              height={1200}
              priority
              sizes="(min-width: 768px) 58vw, 100vw"
              className="h-[64vh] min-h-[440px] w-full object-cover md:h-[84vh]"
              unoptimized
            />
          </div>
        </div>
      </section>

      <section className="border-y border-stone-200 bg-[#f3ede3]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm xss:px-7.5 md:grid-cols-4">
          {copy.valueStrip.map((item) => (
            <p key={item} className={`text-center text-stone-600 ${locale === "ar" ? "md:text-right" : "md:text-left"}`}>
              {item}
            </p>
          ))}
        </div>
      </section>

      <section id="collection" className="mx-auto max-w-7xl px-4 py-16 xss:px-7.5 md:py-20">
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">{copy.editEyebrow}</p>
            <h2 className="mt-3 text-4xl font-semibold text-ink md:text-5xl">{copy.editTitle}</h2>
          </div>
          <Link href={localizeStorePath("/categories", locale)} className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7d623f] hover:underline">
            {copy.browseCategories}
          </Link>
        </div>
        <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3" data-testid="product-grid">
          {demoProducts.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>
      </section>

      <section id="story" className="border-t border-stone-200 bg-[#f3ede3]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 xss:px-7.5 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">{copy.practiceEyebrow}</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-ink md:text-5xl">{copy.practiceTitle}</h2>
          </div>
          <div className="space-y-5 text-base leading-7 text-stone-600">
            <p>{copy.practiceBodyOne}</p>
            <p>{copy.practiceBodyTwo}</p>
          </div>
        </div>
      </section>

      <section id="journal" className="mx-auto max-w-7xl px-4 py-16 xss:px-7.5 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">{copy.journalEyebrow}</p>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {featured.map((product, index) => {
            const localizedProduct = productCopy(product, locale);
            return (
              <article key={product.id} className="border-t border-stone-200 pt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  {copy.fieldNotes} - No. {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-ink">
                  {copy.journalTitlePrefix} {localizedProduct.name}
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{localizedProduct.tagline}</p>
                <p className="mt-4 text-sm font-semibold tabular-nums text-ink">{formatProductPrice(product)}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
