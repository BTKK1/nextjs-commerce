import Link from "next/link";
import {
  Bot,
  Eye,
  HelpCircle,
  MessageCircle,
  MessageSquareWarning,
  MousePointerClick,
  Star,
  TrendingUp
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { getDashboardOverview } from "@/lib/dashboard/aggregation";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const overview = getDashboardOverview();
  const { kpis } = overview;
  const topInsights = overview.insights.slice(0, 5);

  const cards = [
    { label: "Product page views", value: kpis.productPageViews, detail: "Tracked from demo product pages.", icon: Eye },
    { label: "Widget impressions", value: kpis.widgetImpressions, detail: "AI widget rendered on product pages.", icon: Bot },
    { label: "Conversation starts", value: kpis.conversationStarts, detail: "New shopper conversations logged.", icon: MessageCircle },
    { label: "Interaction rate", value: `${kpis.interactionRate}%`, detail: "Conversation starts divided by product views.", icon: TrendingUp },
    { label: "Total messages", value: kpis.totalMessages, detail: "Seeded and live demo messages.", icon: MousePointerClick },
    { label: "Unknown-answer rate", value: `${kpis.unknownAnswerRate}%`, detail: "Assistant messages that used fallback.", icon: HelpCircle },
    { label: "Objections", value: kpis.objectionsCount, detail: "Detected price, gift, quality, or suitability concerns.", icon: MessageSquareWarning },
    { label: "Answer quality", value: kpis.answerQualityRating ?? "No ratings", detail: "Seeded review score where available.", icon: Star }
  ];

  return (
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

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-kpis">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-md border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h2 className="font-semibold text-ink">Recent conversations</h2>
            <Link href="/dashboard/conversations" className="text-sm font-semibold text-qahwa hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
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

        <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
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
    </main>
  );
}
