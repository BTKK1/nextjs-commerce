import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { demoProducts } from "@/data/catalog";

function categorySlug(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const categories = Array.from(new Set(demoProducts.map((product) => product.category))).map((category) => ({
  name: category,
  slug: categorySlug(category),
  count: demoProducts.filter((product) => product.category === category).length,
}));

export const metadata = {
  title: "Categories | Maison Vert",
  description: "Browse the Maison Vert collection by category.",
};

export default function CategoriesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-screen-2xl px-4 py-10 xss:px-7.5">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Collection</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Categories</h1>
        <p className="mt-3 max-w-2xl text-stone-700">
          These categories are generated from the Maison Vert product catalog used by this Bagisto storefront.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/search"
          className="group rounded-md border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">All products</h2>
              <p className="mt-1 text-sm text-stone-600">{demoProducts.length} items</p>
            </div>
            <ArrowRight className="h-5 w-5 text-[#7d623f] transition group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
        </Link>

        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/search/${category.slug}`}
            className="group rounded-md border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{category.name}</h2>
                <p className="mt-1 text-sm text-stone-600">{category.count} items</p>
              </div>
              <ArrowRight className="h-5 w-5 text-[#7d623f] transition group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
