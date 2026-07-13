import type { Metadata } from "next";
import { ProductCard } from "@/components/saleh-demo/ProductCard";
import { demoProducts } from "@/data/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";

  return {
    title: query ? `Search: ${query} | Maison Vert` : "Search Products | Maison Vert",
    description: "Search the Maison Vert collection.",
  };
}

function includesQuery(value: string | string[], query: string) {
  const haystack = Array.isArray(value) ? value.join(" ") : value;
  return haystack.toLowerCase().includes(query);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim().toLowerCase() : "";
  const products = query
    ? demoProducts.filter((product) =>
        [
          product.name,
          product.arabicName,
          product.category,
          product.shortDescription,
          product.longDescription,
          product.tags,
        ].some((value) => includesQuery(value, query)),
      )
    : demoProducts;

  return (
    <main className="mx-auto min-h-screen max-w-screen-2xl px-4 py-10 xss:px-7.5">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Search</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">
          {query ? `Results for "${query}"` : "All products"}
        </h1>
        <p className="mt-3 max-w-2xl text-stone-700">
          Search is backed by the Maison Vert product catalog.
        </p>
      </div>

      {products.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-stone-200 bg-white p-8 text-stone-700">
          No demo products matched this search.
        </div>
      )}
    </main>
  );
}
