import Link from "next/link";
import {
  Bot,
  Activity,
  CircleDollarSign,
  Cpu,
  Eye,
  Flame,
  HelpCircle,
  MessageCircle,
  MessageSquareWarning,
  MousePointerClick,
  Star,
  Timer,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { getDashboardOverviewForRequest } from "@/lib/dashboard/server";
import { readGlobalAgentConfig } from "@/lib/agent/global-config";
import { getModelPricing } from "@/lib/ai/model-pricing";

export const dynamic = "force-dynamic";

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: value < 1 ? 4 : 2, maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
}

export default async function DashboardPage() {
  const [overview, globalAgent] = await Promise.all([
    getDashboardOverviewForRequest(),
    readGlobalAgentConfig(),
  ]);
  const { kpis } = overview;
  const wallet = overview.tokenWallet;
  const currentPricing = getModelPricing(globalAgent.modelName);
  const topInsights = overview.insights.slice(0, 5);

  const cards = [
    { label: "Product page views", value: kpis.productPageViews, detail: "Tracked product pages for this merchant.", icon: Eye },
    { label: "Widget impressions", value: kpis.widgetImpressions, detail: "AI widget rendered on product pages.", icon: Bot },
    { label: "Conversation starts", value: kpis.conversationStarts, detail: "New shopper conversations logged.", icon: MessageCircle },
    { label: "Interaction rate", value: kpis.interactionRate == null ? "No data" : `${kpis.interactionRate}%`, detail: "Tracked conversation starts divided by tracked product views.", icon: TrendingUp },
    { label: "Engaged conversations", value: kpis.engagedConversations, detail: "Conversations where a shopper asked at least two questions.", icon: Activity },
    { label: "Grounded answer rate", value: kpis.groundedAnswerRate == null ? "No data" : `${kpis.groundedAnswerRate}%`, detail: "Agent replies answered from available context without a fallback.", icon: Bot },
    { label: "Median response time", value: kpis.medianResponseMs == null ? "No data" : `${(kpis.medianResponseMs / 1000).toFixed(1)}s`, detail: "Typical recorded model response time.", icon: Timer },
    { label: "Total messages", value: kpis.totalMessages, detail: "Logged shopper and assistant messages.", icon: MousePointerClick },
    { label: "Unknown-answer rate", value: `${kpis.unknownAnswerRate}%`, detail: "Assistant messages that used fallback.", icon: HelpCircle },
    { label: "Objections", value: kpis.objectionsCount, detail: "Detected price, gift, quality, or suitability concerns.", icon: MessageSquareWarning },
    { label: "Repeated questions", value: kpis.repeatedQuestionsCount, detail: "Questions recurring across shopper conversations.", icon: MessageCircle },
    { label: "Weak descriptions", value: kpis.weakDescriptionSignals, detail: "Catalog gaps surfaced by shopper questions.", icon: HelpCircle },
    { label: "Answer quality", value: kpis.answerQualityRating ?? "No ratings", detail: "Seeded review score where available.", icon: Star }
  ];
  const activeProducts = overview.products.map((product) => ({
    product,
    conversations: overview.conversations.filter((conversation) => conversation.productSlug === product.slug).length,
    messages: overview.conversations.filter((conversation) => conversation.productSlug === product.slug).reduce((sum, conversation) => sum + conversation.messageCount, 0),
  })).sort((a, b) => b.conversations - a.conversations || b.messages - a.messages).slice(0, 5);

  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-qahwa">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{overview.merchant.name}</h1>
          <p className="mt-2 max-w-3xl text-stone-700">
            Store-owner view for repeated questions, objections, weak description signals, and fallback events.
          </p>
        </div>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-kpis">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </section>

      <section className="mt-8 overflow-hidden rounded-[24px] border border-[#DED8F5] bg-white shadow-[0_22px_60px_-42px_rgba(54,31,144,.6)]" data-testid="token-wallet">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#5B2EFF] text-white shadow-[0_10px_24px_rgba(91,46,255,.24)]"><WalletCards className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h2 className="text-xl font-bold text-[#17131F]">Token wallet</h2>
                  <p className="mt-1 text-sm leading-6 text-[#676171]">Real model usage for this store. The balance is the included monthly token allowance, not cash.</p>
                </div>
              </div>
              <div className="rounded-full border border-[#DDD5FA] bg-[#F5F2FF] px-3 py-1.5 text-xs font-bold text-[#5B2EFF]">Current cycle</div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[17px] border border-[#E8E4F2] bg-[#FCFBFF] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[#6C7180]"><WalletCards className="h-4 w-4 text-[#5B2EFF]" />Tokens remaining</p><p className="mt-2 text-2xl font-bold tracking-tight text-[#17131F]">{compactNumber(wallet.remainingThisCycle)}</p><p className="mt-1 text-xs text-[#777281]">of {compactNumber(wallet.monthlyAllowance)} this month</p></div>
              <div className="rounded-[17px] border border-[#E8E4F2] bg-[#FCFBFF] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[#6C7180]"><Flame className="h-4 w-4 text-[#F97316]" />Tokens burned</p><p className="mt-2 text-2xl font-bold tracking-tight text-[#17131F]">{compactNumber(wallet.consumedThisCycle)}</p><p className="mt-1 text-xs text-[#777281]">{compactNumber(wallet.lifetimeConsumed)} lifetime</p></div>
              <div className="rounded-[17px] border border-[#E8E4F2] bg-[#FCFBFF] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[#6C7180]"><TrendingUp className="h-4 w-4 text-[#5B2EFF]" />7-day burn rate</p><p className="mt-2 text-2xl font-bold tracking-tight text-[#17131F]">{compactNumber(wallet.dailyBurnRate)}<span className="ml-1 text-sm font-semibold text-[#777281]">/ day</span></p><p className="mt-1 text-xs text-[#777281]">{wallet.projectedDaysRemaining == null ? "No recent burn" : `About ${wallet.projectedDaysRemaining} days remaining`}</p></div>
              <div className="rounded-[17px] border border-[#E8E4F2] bg-[#FCFBFF] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[#6C7180]"><CircleDollarSign className="h-4 w-4 text-emerald-600" />Estimated cost</p><p className="mt-2 text-2xl font-bold tracking-tight text-[#17131F]">{usd(wallet.estimatedCostUsdThisCycle)}</p><p className="mt-1 text-xs text-[#777281]">Provider usage estimate this month</p></div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-4 text-xs font-semibold text-[#5C6272]"><span>Monthly allowance used</span><span>{wallet.usagePercent}%</span></div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#EEEAF8]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#5B2EFF,#8B5CF6)] transition-[width]" style={{ width: `${Math.min(100, wallet.usagePercent)}%` }} /></div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-4"><h3 className="text-sm font-bold text-[#292530]">Daily token burn</h3><span className="text-xs text-[#777281]">Last 7 days · {compactNumber(wallet.last7DaysConsumed)} tokens</span></div>
              <div className="mt-4 grid h-32 grid-cols-7 items-end gap-2" aria-label="Daily token usage over the last seven days">
                {wallet.dailyUsage.map((day) => {
                  const peak = Math.max(1, ...wallet.dailyUsage.map((item) => item.tokens));
                  const height = day.tokens > 0 ? Math.max(8, Math.round((day.tokens / peak) * 100)) : 3;
                  return <div key={day.date} className="flex h-full min-w-0 flex-col justify-end gap-2" title={`${day.date}: ${day.tokens.toLocaleString("en-US")} tokens`}><div className="mx-auto w-full max-w-12 rounded-t-[9px] bg-[linear-gradient(180deg,#8B5CF6,#5B2EFF)]" style={{ height: `${height}%` }} /><span className="truncate text-center text-[10px] font-semibold text-[#686271]">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span></div>;
                })}
              </div>
            </div>
          </div>

          <aside className="border-t border-[#E9E4F7] bg-[radial-gradient(520px_260px_at_100%_0%,rgba(91,46,255,.16),transparent_68%),#FBFAFF] p-5 sm:p-7 xl:border-l xl:border-t-0">
            <div className="flex items-center gap-2 text-sm font-bold text-[#292530]"><Cpu className="h-4 w-4 text-[#5B2EFF]" />Current model rate</div>
            <p className="mt-3 break-words text-lg font-bold text-[#17131F]">{globalAgent.modelName}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6B6572]">{globalAgent.modelProvider}</p>
            {currentPricing ? <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-[15px] border border-white/80 bg-white/80 p-4"><p className="text-xs text-[#777281]">Input</p><p className="mt-1 text-lg font-bold text-[#17131F]">{usd(currentPricing.inputUsdPerMillionTokens)}</p><p className="text-[11px] text-[#686271]">per 1M tokens</p></div><div className="rounded-[15px] border border-white/80 bg-white/80 p-4"><p className="text-xs text-[#777281]">Output</p><p className="mt-1 text-lg font-bold text-[#17131F]">{usd(currentPricing.outputUsdPerMillionTokens)}</p><p className="text-[11px] text-[#686271]">per 1M tokens</p></div></div> : <p className="mt-5 rounded-[15px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">A stored provider rate is not available for this model. Tokens are still counted; cost stays unestimated.</p>}
            <div className="mt-5 rounded-[15px] border border-[#E1DCF0] bg-white/70 p-4 text-xs leading-5 text-[#676171]"><p><span>Cost coverage:</span>{" "}<strong className="text-[#292530]">{wallet.costCoveragePercent}%</strong>{" "}<span>of lifetime recorded tokens.</span></p><p className="mt-2">Messages created before usage telemetry remain visible but are never assigned made-up tokens or cost.</p></div>
          </aside>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 rounded-md border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h2 className="font-semibold text-ink">Recent conversations</h2>
            <Link href="/dashboard/conversations" className="text-sm font-semibold text-qahwa hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Five most recent shopper conversations</caption>
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Visitor</th>
                  <th className="px-5 py-3 font-medium">Messages</th>
                  <th className="px-5 py-3 font-medium">Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {overview.conversations.slice(0, 5).map((conversation) => (
                  <tr key={conversation.id}>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/conversations/${conversation.id}`} className="font-medium text-ink hover:text-qahwa">
                        {conversation.productName}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-stone-600">{conversation.visitorRef}</td>
                    <td className="px-5 py-4 text-stone-600">{conversation.messageCount}</td>
                    <td className="px-5 py-4">
                      <StatusPill value={conversation.fallbackReason} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 rounded-md border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Top insight signals</h2>
          <div className="mt-4 space-y-4" data-testid="top-insights">
            {topInsights.map((insight) => (
              <div key={insight.id} className="rounded-md bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{insight.title}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">{insight.detail}</p>
                  </div>
                  <span className="rounded-md bg-white px-2 py-1 text-sm font-semibold text-qahwa">{insight.count}</span>
                </div>
                <div className="mt-3">
                  <StatusPill value={insight.type} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 min-w-0 rounded-md border border-stone-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-ink">Most active products</h2><p className="mt-1 text-sm text-stone-600">Ranked by logged shopper conversations and messages.</p></div><Link href="/dashboard/products" className="text-sm font-semibold text-qahwa hover:underline">Review content</Link></div><div className="mt-4 overflow-x-auto" tabIndex={0} aria-label="Scrollable most active products table"><table className="w-full min-w-[520px] text-left text-sm"><caption className="sr-only">Most active products by conversations and messages</caption><thead className="border-b text-xs uppercase text-stone-500"><tr><th className="py-3">Product</th><th>Conversations</th><th>Messages</th></tr></thead><tbody>{activeProducts.map(({ product, conversations, messages }) => <tr key={product.id} className="border-b border-stone-100"><td className="py-3 font-medium text-ink">{product.name}</td><td>{conversations}</td><td>{messages}</td></tr>)}</tbody></table></div></section>
    </main>
    </DashboardTranslatedServer>
  );
}
