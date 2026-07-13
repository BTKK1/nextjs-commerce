import { DatabaseZap, PlugZap } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { getDashboardOverview } from "@/lib/dashboard/aggregation";

export const dynamic = "force-dynamic";

function providerLabel(provider: string) {
  if (provider === "demo_catalog") return "Demo Catalog";
  if (provider === "salla") return "Salla";
  if (provider === "zid") return "Zid";
  return provider.replaceAll("_", " ");
}

export default function IntegrationsPage() {
  const overview = getDashboardOverview();

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Integrations</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Catalog provider status</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Demo Catalog powers this showcase build. Salla and Zid remain future provider stubs for the client handoff milestone.
        </p>
      </div>

      <section data-testid="integrations-status" className="mt-8 grid gap-5 lg:grid-cols-3">
        {overview.integrations.map((integration) => (
          <article key={integration.id} className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-stone-100 text-qahwa">
                  {integration.provider === "demo_catalog" ? (
                    <DatabaseZap className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <PlugZap className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <h2 className="font-semibold text-ink">{providerLabel(integration.provider)}</h2>
                  <p className="text-sm text-stone-600">{integration.provider}</p>
                </div>
              </div>
              <StatusPill value={integration.status} />
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-700">{integration.notes}</p>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-stone-600">Connected at</dt>
                <dd className="font-medium text-ink">{integration.connectedAt ? new Date(integration.connectedAt).toLocaleDateString("en-US") : "Not connected"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-stone-600">External calls</dt>
                <dd className="font-medium text-ink">{integration.provider === "demo_catalog" ? "Local demo data" : "None in demo"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-md border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Recent catalog sync</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-stone-200 text-xs uppercase text-stone-500">
              <tr>
                <th className="py-3 pr-4">Provider</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Finished</th>
                <th className="py-3 pr-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {overview.syncJobs.map((job) => (
                <tr key={job.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-3 pr-4 font-medium text-ink">{providerLabel(job.provider)}</td>
                  <td className="py-3 pr-4">
                    <StatusPill value={job.status} />
                  </td>
                  <td className="py-3 pr-4 text-stone-700">{job.finishedAt ? new Date(job.finishedAt).toLocaleString("en-US") : "Pending"}</td>
                  <td className="py-3 pr-4 text-stone-700">{job.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
