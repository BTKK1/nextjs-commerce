import { Pagination } from "@/components/dashboard/Pagination";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { requireDashboardAdminUser } from "@/lib/auth/require-user";
import { getAuditLogsForDashboard } from "@/lib/audit/audit-log";
import { getDashboardLocale, dashboardDateLocale } from "@/lib/dashboard/i18n";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await requireDashboardAdminUser();
  const [auditLogs, locale] = await Promise.all([getAuditLogsForDashboard(identity), getDashboardLocale()]);
  const query = await searchParams;
  const rawPage = typeof query.page === "string" ? query.page : "";
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(auditLogs.length / pageSize));
  const page = Math.min(Math.max(Number.parseInt(rawPage, 10) || 1, 1), totalPages);
  const pagedLogs = auditLogs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <p className="text-sm font-semibold uppercase text-qahwa">Governance</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Audit Log</h1>
      <p className="mt-2 max-w-3xl text-stone-700">Trace prompt edits, QA runs, publishes, rollbacks, settings changes, integrations, and system actions.</p>

      <section className="mt-8 overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-5 py-4">
          <p className="text-sm font-medium text-ink">{auditLogs.length} recorded event{auditLogs.length === 1 ? "" : "s"}</p>
          <p className="mt-1 text-xs text-stone-500">Newest events appear first. Expand details when you need evidence.</p>
        </div>
        <div className="overflow-x-auto px-5">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Merchant audit events</caption>
            <thead className="border-b text-xs uppercase text-stone-500">
              <tr><th className="py-3">Time</th><th>Action</th><th>Actor</th><th>Entity</th><th>Details</th></tr>
            </thead>
            <tbody>
              {pagedLogs.map((log) => (
                <tr key={String(log.id)} className="border-b border-stone-100 align-top">
                  <td className="whitespace-nowrap py-3 pr-4 text-stone-600">{new Date(String(log.created_at)).toLocaleString(dashboardDateLocale(locale))}</td>
                  <td className="py-3 pr-4"><StatusPill value={String(log.action)}/></td>
                  <td className="py-3 pr-4">{String(log.actor_type)}</td>
                  <td className="py-3 pr-4">{String(log.entity_type ?? "—")}</td>
                  <td className="py-3">
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-qahwa">View details</summary>
                      <pre className="mt-2 max-h-56 max-w-md overflow-auto whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs leading-5 text-stone-700">{JSON.stringify(log.details_json ?? {}, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!auditLogs.length ? <p className="py-8 text-center text-sm text-stone-600">No audit events yet.</p> : null}
        {auditLogs.length ? <Pagination basePath="/dashboard/audit-log" currentPage={page} pageSize={pageSize} totalItems={auditLogs.length} /> : null}
      </section>
    </main>
    </DashboardTranslatedServer>
  );
}
