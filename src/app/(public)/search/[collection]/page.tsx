import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/saleh-demo/ProductCard";
import { demoProducts } from "@/data/catalog";

export const dynamic = "force-dynamic";

function categorySlug(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function categoryForSlug(slug: string) {
  return Array.from(new Set(demoProducts.map((product) => product.category))).find(
    (category) => categorySlug(category) === slug,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collection: string }>;
}): Promise<Metadata> {
  const { collection } = await params;
  const category = categoryForSlug(collection);
  if (!category) return { title: "Category | Maison Vert" };

  return {
    title: `${category} | Maison Vert`,
    description: `Browse ${category} products in the Maison Vert collection.`,
  };
}

export default async function CategorySearchPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  const category = categoryForSlug(collection);
  if (!category) notFound();

  const products = demoProducts.filter((product) => product.category === category);

  return (
    <main className="mx-auto min-h-screen max-w-screen-2xl px-4 py-10 xss:px-7.5">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Category</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{category}</h1>
        <p className="mt-3 max-w-2xl text-stone-700">
          Products in this category are served from the Maison Vert catalog.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </main>
  );
}
