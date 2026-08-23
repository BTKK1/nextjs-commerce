import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { formatProductPrice } from "@/data/catalog";
import { localizeStorePath, productCopy, storeCopy, type StoreLocale } from "@/components/saleh-demo/store-i18n";
import type { DemoProduct } from "@/lib/types";

export function ProductCard({ product, locale = "en" }: { product: DemoProduct; locale?: StoreLocale }) {
  const localizedProduct = productCopy(product, locale);
  const copy = storeCopy[locale].card;

  return (
    <article className="group flex h-full flex-col overflow-hidden border border-stone-200/80 bg-white shadow-[0_18px_42px_-36px_rgba(41,37,36,0.45)] transition duration-300 hover:-translate-y-0.5 hover:border-stone-300">
      <Link href={localizeStorePath(`/product/${product.slug}`, locale)} className="flex h-full flex-col">
        <div className="flex aspect-[5/6] items-center justify-center overflow-hidden bg-[#f3eadb]">
          <Image
            src={product.imagePath}
            alt={localizedProduct.name}
            width={1000}
            height={1200}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
            className="h-auto w-full scale-[1.02] object-cover transition duration-700 group-hover:scale-[1.055]"
            style={{ width: "100%", height: "auto" }}
            loading="eager"
            unoptimized
          />
        </div>
        <div className="flex flex-1 flex-col space-y-4 px-4 py-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="min-w-0 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 [overflow-wrap:anywhere]">
                {localizedProduct.category}
              </span>
              <span className="text-sm font-semibold tabular-nums text-ink">{formatProductPrice(product)}</span>
            </div>
            <h3 className="text-lg font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{localizedProduct.name}</h3>
            {localizedProduct.tagline ? <p className="mt-1 text-sm italic text-stone-600">{localizedProduct.tagline}</p> : null}
          </div>
          <p className="text-sm leading-6 text-stone-700">{localizedProduct.shortDescription}</p>
          <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-4 text-sm">
            <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.16em] text-ink">
              {copy.viewPiece}
              <ArrowRight className={`h-4 w-4 transition ${locale === "ar" ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
