import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Pagination } from "@/components/dashboard/Pagination";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { NbehSelect } from "@/components/dashboard/NbehSelect";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { getDashboardOverviewForRequest } from "@/lib/dashboard/server";
import { dashboardDateLocale, getDashboardLocale } from "@/lib/dashboard/i18n";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ conversations }, locale] = await Promise.all([getDashboardOverviewForRequest(), getDashboardLocale()]);
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const q = value("q").toLowerCase();
  const product = value("product"); const language = value("language"); const fallback = value("fallback"); const objection = value("objection"); const from = value("from");
  const filtered = conversations.filter((conversation) => (!q || `${conversation.productName} ${conversation.visitorRef}`.toLowerCase().includes(q)) && (!product || conversation.productSlug === product) && (!language || conversation.language === language) && (!fallback || conversation.fallbackReason === fallback) && (!objection || conversation.detectedObjection === objection) && (!from || new Date(conversation.updatedAt).getTime() >= new Date(`${from}T00:00:00`).getTime()));
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requestedPage = Number.parseInt(value("page"), 10) || 1;
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const pagedConversations = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeQuery = Object.fromEntries(["q", "product", "language", "fallback", "objection", "from"].map((key) => [key, value(key)]).filter(([, item]) => Boolean(item)));
  const products = [...new Map(conversations.map((conversation) => [conversation.productSlug, conversation.productName])).entries()];
  const fallbackReasons = [...new Set(conversations.map((item) => item.fallbackReason).filter((item): item is string => Boolean(item)))];
  const objections = [...new Set(conversations.map((item) => item.detectedObjection).filter((item): item is string => Boolean(item)))];

  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Conversation review</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Conversations</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Each transcript is tied to a product, anonymous visitor, fallback reason, and detected objection.
        </p>
      </div>

      <form role="search" aria-label="Filter conversations" className="mt-8 grid gap-4 rounded-md border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-600 xl:col-span-2">Search
          <input name="q" defaultValue={value("q")} placeholder="Product or anonymous visitor" className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-normal normal-case tracking-normal"/>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-600">Product
          <NbehSelect name="product" defaultValue={product} ariaLabel="Product" className="mt-2 normal-case tracking-normal" options={[{ value: "", label: "All products" }, ...products.map(([slug, name]) => ({ value: slug, label: name }))]} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-600">Language
          <NbehSelect name="language" defaultValue={language} ariaLabel="Language" className="mt-2 normal-case tracking-normal" options={[{ value: "", label: "All languages" }, { value: "en", label: "English" }, { value: "ar", label: "Arabic" }]} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-600">Fallback reason
          <NbehSelect name="fallback" defaultValue={fallback} ariaLabel="Fallback reason" className="mt-2 normal-case tracking-normal" options={[{ value: "", label: "All fallback reasons" }, ...fallbackReasons.map((item) => ({ value: item, label: item.replaceAll("_", " ") }))]} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-600">From date
          <input type="date" name="from" defaultValue={from} className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-normal normal-case tracking-normal"/>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-600 xl:col-span-2">Objection
          <NbehSelect name="objection" defaultValue={objection} ariaLabel="Objection" className="mt-2 normal-case tracking-normal" options={[{ value: "", label: "All objections" }, ...objections.map((item) => ({ value: item, label: item.replaceAll("_", " ") }))]} />
        </label>
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
          <button className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white">Apply filters</button>
          {Object.keys(activeQuery).length ? <Link href="/dashboard/conversations" className="rounded-md border border-stone-300 px-4 py-2.5 text-sm font-semibold text-ink">Clear</Link> : null}
        </div>
      </form>

      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={MessageSquareText}
            title={conversations.length ? "No matching conversations" : "No conversations yet"}
            body={conversations.length ? "Adjust or clear the filters to see more transcripts." : "Open a product page and ask the AI agent a question to create the first transcript."}
          />
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-5 py-4">
            <p className="text-sm font-medium text-ink">{filtered.length} matching conversation{filtered.length === 1 ? "" : "s"}</p>
            <p className="mt-1 text-xs text-stone-500">Newest activity appears first.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="conversations-table">
              <caption className="sr-only">Filtered shopper conversations</caption>
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Date/time</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Visitor</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Language</th>
                  <th className="px-5 py-3 font-medium">Messages</th>
                  <th className="px-5 py-3 font-medium">Fallback</th>
                  <th className="px-5 py-3 font-medium">Objection</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pagedConversations.map((conversation) => (
                  <tr key={conversation.id}>
                    <td className="px-5 py-4 text-stone-600">{new Date(conversation.updatedAt).toLocaleString(dashboardDateLocale(locale))}</td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/conversations/${conversation.id}`} className="font-medium text-ink hover:text-qahwa">
                        {conversation.productName}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-stone-600">{conversation.visitorRef}</td>
                    <td className="px-5 py-4">
                      <StatusPill value={conversation.status} />
                    </td>
                    <td className="px-5 py-4 text-stone-600">{conversation.language || "—"}</td>
                    <td className="px-5 py-4 text-stone-600">{conversation.messageCount}</td>
                    <td className="px-5 py-4">
                      <StatusPill value={conversation.fallbackReason} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill value={conversation.detectedObjection} />
                    </td>
                    <td className="px-5 py-4 text-stone-600">{conversation.score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/dashboard/conversations" currentPage={page} pageSize={pageSize} totalItems={filtered.length} query={activeQuery} />
        </div>
      )}
    </main>
    </DashboardTranslatedServer>
  );
}
