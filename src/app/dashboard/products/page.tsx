import Link from "next/link";
import Image from "next/image";
import { FilePenLine } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { getDashboardOverviewForRequest } from "@/lib/dashboard/server";
import { requireDashboardAdminUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

function contentCompleteness(product: { longDescription: string; faqs: unknown[]; careShippingNotes: string; variants: unknown[]; material?: string; weakDescriptionSignals: string[] }) {
  const checks = [product.longDescription.length > 120, product.faqs.length >= 2, product.careShippingNotes.length > 20, product.variants.length > 0, Boolean(product.material), product.weakDescriptionSignals.length === 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function weakFields(product: { longDescription: string; faqs: unknown[]; careShippingNotes: string; variants: unknown[]; material?: string }) {
  return [
    product.longDescription.length <= 120 ? "Long description" : null,
    product.faqs.length < 2 ? "FAQs" : null,
    product.careShippingNotes.length <= 20 ? "Care and shipping" : null,
    product.variants.length === 0 ? "Variants" : null,
    !product.material ? "Material" : null,
  ].filter((item): item is string => Boolean(item));
}

export default async function DashboardProductsPage() {
  await requireDashboardAdminUser();
  const { insights, products } = await getDashboardOverviewForRequest();
  const weakInsights = insights.filter((insight) => insight.type === "weak_description");

  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Product content</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Product content quality</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Products with weak fields, missing details, and FAQ opportunities from shopper questions.
        </p>
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        {products.map((product) => {
          const productWeakInsights = weakInsights.filter((insight) => insight.productSlug === product.slug);
          const completeness = contentCompleteness(product);
          const missing = weakFields(product);
          return (
            <article key={product.id} className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex gap-4">
                <Image src={product.imagePath} alt={product.name} width={96} height={115} className="h-24 w-24 rounded-md object-cover" unoptimized />
                <div className="min-w-0">
                  <h2 className="font-semibold text-ink">{product.name}</h2>
                  <p className="mt-1 text-sm text-stone-600">{product.category}</p>
                  <div className="mt-2 flex items-center gap-2"><StatusPill value={completeness >= 80 ? "Complete" : "Needs work"}/><span className="text-sm font-semibold text-ink">{completeness}% content completeness</span></div>
                  <Link href={`/store/product/${product.slug}`} className="mt-2 inline-block text-sm font-semibold text-qahwa hover:underline">
                    Open product
                  </Link>
                </div>
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-stone-800">Weak description signals</h3>
                <div className="mt-3 space-y-2">
                  {missing.map((field) => <div key={field} className="rounded-md bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-900">Missing or incomplete: {field}</div>)}
                  {product.weakDescriptionSignals.map((signal) => (
                    <div key={signal} className="rounded-md bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
                      {signal}
                    </div>
                  ))}
                </div>
              </div>
              <details className="mt-5 rounded-md border border-stone-300 p-3"><summary className="cursor-pointer text-sm font-semibold text-qahwa">Generate content improvement suggestions</summary><div className="mt-4 space-y-2 text-sm leading-6 text-stone-700">{missing.length ? missing.map((field) => <p key={field}>• Complete the {field.toLowerCase()} field using verified merchant/catalog information.</p>) : <p>• Core catalog fields are complete; prioritize shopper-language refinements.</p>}{product.weakDescriptionSignals.map((signal) => <p key={signal}>• Address “{signal}” with a concise fact-backed paragraph or FAQ.</p>)}{productWeakInsights.map((insight) => <p key={insight.id}>• Add an FAQ answering: {insight.detail}</p>)}</div></details>
              <details className="mt-4 rounded-md bg-stone-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-ink">Product detail</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-stone-500">Material</dt><dd>{product.material || "Missing"}</dd></div><div><dt className="text-stone-500">Variants</dt><dd>{product.variants.length}</dd></div><div><dt className="text-stone-500">FAQs</dt><dd>{product.faqs.length}</dd></div><div><dt className="text-stone-500">Care/shipping</dt><dd>{product.careShippingNotes || "Missing"}</dd></div></dl></details>
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
    </DashboardTranslatedServer>
  );
}
