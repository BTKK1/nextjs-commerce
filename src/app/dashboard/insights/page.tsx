import Link from "next/link";
import { groupInsightsByProduct } from "@/lib/dashboard/aggregation";
import { getDashboardOverviewForRequest } from "@/lib/dashboard/server";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Pagination } from "@/components/dashboard/Pagination";
import { updateInsightStatusAction } from "@/app/dashboard/insights/actions";
import { requireDashboardUser } from "@/lib/auth/require-user";
import { canManageProducts } from "@/lib/auth/roles";
import { NbehSelect } from "@/components/dashboard/NbehSelect";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { ActionFeedback } from "@/components/dashboard/ActionFeedback";
import { DashboardActionButton } from "@/components/dashboard/DashboardActionButton";

export const dynamic = "force-dynamic";

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await requireDashboardUser();
  const canManage = canManageProducts(identity.role);
  const { insights, products, insightSources } = await getDashboardOverviewForRequest();
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const type = value("type");
  const status = value("status");
  const filteredInsights = insights.filter((insight) => (!type || insight.type === type) && (!status || insight.status === status));
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredInsights.length / pageSize));
  const requestedPage = Number.parseInt(value("page"), 10) || 1;
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const pagedInsights = filteredInsights.slice((page - 1) * pageSize, page * pageSize);
  const groups = groupInsightsByProduct(pagedInsights);
  const activeQuery = Object.fromEntries([["type", type], ["status", status]].filter(([, item]) => Boolean(item)));
  const repeated = insights.filter((insight) => insight.type === "repeated_question");
  const objections = insights.filter((insight) => insight.type === "objection");
  const weak = insights.filter((insight) => insight.type === "weak_description");
  const unknown = insights.filter((insight) => insight.type === "unknown_answer");

  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Insights</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Repeated questions and objections</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Logged conversations become evidence-backed product-content actions for the merchant team.
        </p>
      </div>
      <div id="dashboard-feedback" className="scroll-mt-6"><ActionFeedback query={query} successTitle="Insight updated" /></div>

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

      <form role="search" aria-label="Filter insights" className="mt-8 flex flex-col gap-4 rounded-md border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Signal type
          <NbehSelect name="type" defaultValue={type} ariaLabel="Signal type" className="mt-2 normal-case tracking-normal" options={[{ value: "", label: "All signal types" }, { value: "repeated_question", label: "Repeated questions" }, { value: "objection", label: "Objections" }, { value: "weak_description", label: "Weak descriptions" }, { value: "unknown_answer", label: "Unknown answers" }, { value: "answer_quality", label: "Answer quality" }]} />
        </label>
        <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Workflow status
          <NbehSelect name="status" defaultValue={status} ariaLabel="Workflow status" className="mt-2 normal-case tracking-normal" options={[{ value: "", label: "All statuses" }, { value: "open", label: "Open" }, { value: "reviewed", label: "Reviewed" }, { value: "resolved", label: "Resolved" }, { value: "ignored", label: "Ignored" }]} />
        </label>
        <div className="flex gap-2">
          <button className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white">Apply filters</button>
          {Object.keys(activeQuery).length ? <Link href="/dashboard/insights" className="rounded-md border border-stone-300 px-4 py-2.5 text-sm font-semibold text-ink">Clear</Link> : null}
        </div>
      </form>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-stone-600">{filteredInsights.length} insight{filteredInsights.length === 1 ? "" : "s"}</p>
        <p className="text-xs text-stone-500">Highest-frequency signals first</p>
      </div>

      <section className="mt-4 space-y-6">
        {!filteredInsights.length ? <div className="rounded-md border border-dashed border-stone-300 bg-white p-8 text-center"><h2 className="font-semibold text-ink">No matching insights</h2><p className="mt-2 text-sm text-stone-600">Adjust or clear the filters to return to the full signal queue.</p></div> : null}
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
                  <Link href={`/store/product/${product.slug}`} className="text-sm font-semibold text-qahwa hover:underline">
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
                      <StatusPill value={insight.severity} />
                      <StatusPill value={insight.status} />
                    </div>
                    {insightSources.filter((source) => source.insightId === insight.id).slice(0, 3).map((source) => <Link key={source.id} href={`/dashboard/conversations/${source.conversationId}`} className="mt-3 mr-3 inline-block text-xs font-semibold text-qahwa hover:underline">View conversation evidence</Link>)}
                    {canManage ? <form action={updateInsightStatusAction} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="insight_id" value={insight.id}/>{["reviewed","resolved","ignored"].map((nextStatus) => <DashboardActionButton key={nextStatus} name="status" value={nextStatus} label={nextStatus} pendingLabel="Saving status…" disabled={insight.status === nextStatus} className="rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold capitalize disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400" />)}</form> : <p className="mt-4 text-xs text-stone-500">Read-only role</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
      {filteredInsights.length ? <div className="mt-8 overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm"><Pagination basePath="/dashboard/insights" currentPage={page} pageSize={pageSize} totalItems={filteredInsights.length} query={activeQuery} /></div> : null}
    </main>
    </DashboardTranslatedServer>
  );
}
