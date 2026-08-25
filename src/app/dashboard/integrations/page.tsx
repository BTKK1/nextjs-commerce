import { DatabaseZap, PlugZap } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { getDashboardOverviewForRequest } from "@/lib/dashboard/server";
import { requireDashboardUser } from "@/lib/auth/require-user";
import { canManageIntegrations } from "@/lib/auth/roles";
import { dashboardDateLocale, getDashboardLocale } from "@/lib/dashboard/i18n";
import { ActionFeedback } from "@/components/dashboard/ActionFeedback";
import { DashboardActionButton } from "@/components/dashboard/DashboardActionButton";
import { IntegrationSyncButton } from "@/components/dashboard/IntegrationSyncButton";

export const dynamic = "force-dynamic";

function providerLabel(provider: string) {
  if (provider === "demo_catalog") return "Demo Catalog";
  if (provider === "salla") return "Salla";
  if (provider === "zid") return "Zid";
  return provider.replaceAll("_", " ");
}

function connectedHelp(provider: string) {
  if (provider === "salla") return "Salla product changes sync automatically. Use Sync now only when you need an immediate full refresh.";
  if (provider === "zid") return "Zid product changes sync automatically. Use Sync now only when you need an immediate full refresh.";
  return "Product changes sync automatically.";
}

function pendingHelp(provider: string) {
  return provider === "salla"
    ? "Install Nbeh from Salla, approve product access, then return here. Your store workspace is created from the verified Salla owner email."
    : "Connect Zid securely, approve product access, then return here. Nbeh keeps each store’s products and agent isolated.";
}

function recoveryHelp(provider: string) {
  return `${provider === "salla" ? "Salla" : "Zid"} is still installed. Repair checks the saved authorization and refreshes every product; reconnect only if that check says authorization expired.`;
}

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await requireDashboardUser();
  const canConnect = canManageIntegrations(identity.role);
  const [overview, locale, query] = await Promise.all([getDashboardOverviewForRequest(), getDashboardLocale(), searchParams]);

  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Integrations</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Catalog provider status</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Connect your store once. Nbeh then keeps product information current and uses only this store&apos;s catalog in shopper conversations.
        </p>
      </div>
      <div id="dashboard-feedback" className="scroll-mt-6"><ActionFeedback query={query} successTitle="Store connected" /></div>

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
            <p className="mt-2 text-xs font-semibold uppercase text-stone-500">Readiness: {integration.connectionReadiness?.replaceAll("_", " ") ?? "unknown"}</p>
            <div className="mt-4"><p className="text-xs font-semibold uppercase text-stone-500">Required scopes</p><div className="mt-2 flex flex-wrap gap-2">{integration.scopes?.map((scope) => <span key={scope} className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">{scope}</span>)}</div></div>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-stone-600">Connected at</dt>
                <dd className="font-medium text-ink">{integration.connectedAt ? new Date(integration.connectedAt).toLocaleDateString(dashboardDateLocale(locale)) : "Not connected"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-stone-600">External calls</dt>
                <dd className="font-medium text-ink">{integration.provider === "demo_catalog" ? "Development adapter" : integration.status === "connected" ? "Enabled" : "Disabled until OAuth"}</dd>
              </div>
            </dl>
            {integration.provider !== "demo_catalog" && canConnect ? (
              <div className="mt-5 space-y-2">
                {integration.status === "connected" || (["pending", "error"].includes(integration.status) && integration.externalStoreId) ? (
                  <IntegrationSyncButton provider={integration.provider} recovering={integration.status !== "connected"} />
                ) : integration.provider === "salla" ? (
                  <a href={process.env.SALLA_INSTALL_URL || "https://s.salla.sa/apps/install/1132747795"} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white">Install Nbeh on Salla</a>
                ) : (
                  <form action={`/api/integrations/${integration.provider}/oauth/start`} method="post"><DashboardActionButton label="Connect Zid" pendingLabel="Opening secure connection…" className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white" /></form>
                )}
                <p className="text-xs leading-5 text-stone-500">{integration.status === "connected" ? connectedHelp(integration.provider) : (["pending", "error"].includes(integration.status) && integration.externalStoreId) ? recoveryHelp(integration.provider) : pendingHelp(integration.provider)}</p>
              </div>
            ) : integration.provider !== "demo_catalog" ? <p className="mt-5 text-xs leading-5 text-stone-500">Connection controls require an owner or integration administrator.</p> : null}
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-md border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Recent catalog sync</h2>
        <div className="mt-4 overflow-x-auto" tabIndex={0} aria-label="Scrollable recent catalog synchronization table">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Recent catalog synchronization jobs</caption>
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
                  <td className="py-3 pr-4 text-stone-700">{job.finishedAt ? new Date(job.finishedAt).toLocaleString(dashboardDateLocale(locale)) : "Pending"}</td>
                  <td className="py-3 pr-4 text-stone-700">{job.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
    </DashboardTranslatedServer>
  );
}
