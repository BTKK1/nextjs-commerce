import Link from "next/link";
import { getDashboardOverview, groupInsightsByProduct } from "@/lib/dashboard/aggregation";
import { StatusPill } from "@/components/dashboard/StatusPill";

export const dynamic = "force-dynamic";

export default function InsightsPage() {
  const { insights, products } = getDashboardOverview();
  const groups = groupInsightsByProduct(insights);
  const repeated = insights.filter((insight) => insight.type === "repeated_question");
  const objections = insights.filter((insight) => insight.type === "objection");
  const weak = insights.filter((insight) => insight.type === "weak_description");
  const unknown = insights.filter((insight) => insight.type === "unknown_answer");

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Insights</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Repeated questions and objections</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          The demo turns logged conversations into recommended product-content actions.
        </p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="insight-summary">
        {[
          ["Repeated questions", repeated.length],
          ["Objections", objections.length],
          ["Weak descriptions", weak.length],
          ["Unknown answers", unknown.length]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 space-y-6">
        {Object.entries(groups).map(([slug, productInsights]) => {
          const product = products.find((item) => item.slug === slug);
          return (
            <div key={slug} className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-semibold text-ink">{product?.name ?? slug}</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Recommended merchant action: update product copy where shoppers repeatedly ask for missing details.
                  </p>
                </div>
                {product ? (
                  <Link href={`/product/${product.slug}`} className="text-sm font-semibold text-qahwa hover:underline">
                    Open product page
                  </Link>
                ) : null}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {productInsights.map((insight) => (
                  <div key={insight.id} className="rounded-md bg-stone-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium text-ink">{insight.title}</p>
                      <span className="rounded-md bg-white px-2 py-1 text-sm font-semibold text-qahwa">
                        {insight.count}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-700">{insight.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill value={insight.type} />
                      <StatusPill value={insight.category} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
