import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { getDashboardOverview } from "@/lib/dashboard/aggregation";

export const dynamic = "force-dynamic";

export default function ConversationsPage() {
  const { conversations } = getDashboardOverview();

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Conversation review</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Conversations</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Each transcript is tied to a product, anonymous visitor, fallback reason, and detected objection.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={MessageSquareText}
            title="No conversations yet"
            body="Open a product page and ask the AI agent a question to create the first demo transcript."
          />
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="conversations-table">
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Date/time</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Visitor</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Messages</th>
                  <th className="px-5 py-3 font-medium">Fallback</th>
                  <th className="px-5 py-3 font-medium">Objection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {conversations.map((conversation) => (
                  <tr key={conversation.id}>
                    <td className="px-5 py-4 text-stone-600">{new Date(conversation.updatedAt).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/conversations/${conversation.id}`} className="font-medium text-ink hover:text-qahwa">
                        {conversation.productName}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-stone-600">{conversation.visitorRef}</td>
                    <td className="px-5 py-4">
                      <StatusPill value={conversation.status} />
                    </td>
                    <td className="px-5 py-4 text-stone-600">{conversation.messageCount}</td>
                    <td className="px-5 py-4">
                      <StatusPill value={conversation.fallbackReason} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill value={conversation.detectedObjection} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
