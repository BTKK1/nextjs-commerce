import Link from "next/link";
import Image from "next/image";
import { FilePenLine } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { getDashboardOverview } from "@/lib/dashboard/aggregation";

export const dynamic = "force-dynamic";

export default function DashboardProductsPage() {
  const { insights, products } = getDashboardOverview();
  const weakInsights = insights.filter((insight) => insight.type === "weak_description");

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Product content</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Content improvement view</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Products with weak fields, missing details, and FAQ opportunities from shopper questions.
        </p>
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        {products.map((product) => {
          const productWeakInsights = weakInsights.filter((insight) => insight.productSlug === product.slug);
          return (
            <article key={product.id} className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex gap-4">
                <Image src={product.imagePath} alt={product.name} width={96} height={115} className="h-24 w-24 rounded-md object-cover" unoptimized />
                <div className="min-w-0">
                  <h2 className="font-semibold text-ink">{product.name}</h2>
                  <p className="mt-1 text-sm text-stone-600">{product.category}</p>
                  <Link href={`/product/${product.slug}`} className="mt-2 inline-block text-sm font-semibold text-qahwa hover:underline">
                    Open product
                  </Link>
                </div>
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-stone-800">Weak description signals</h3>
                <div className="mt-3 space-y-2">
                  {product.weakDescriptionSignals.map((signal) => (
                    <div key={signal} className="rounded-md bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
                      {signal}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-stone-800">Suggested FAQ additions</h3>
                {productWeakInsights.length ? (
                  <div className="mt-3 space-y-3">
                    {productWeakInsights.map((insight) => (
                      <div key={insight.id} className="rounded-md bg-stone-50 p-3 text-sm leading-6 text-stone-700">
                        <div className="mb-2">
                          <StatusPill value={insight.category} />
                        </div>
                        Add a clearer answer for: {insight.detail}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-stone-600">No live weak-description insight yet; seeded signals still show demo gaps.</p>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={FilePenLine} title="No products" body="Seed the demo catalog to review product content." />
        </div>
      ) : null}
    </main>
  );
}
