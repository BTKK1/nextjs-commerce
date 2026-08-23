import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { CopyTranscriptButton } from "@/components/dashboard/CopyTranscriptButton";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { getConversationDetailForRequest } from "@/lib/dashboard/server";
import { addConversationNoteAction, createConversationInsightAction, rateConversationAction } from "@/app/dashboard/conversations/actions";
import { requireDashboardUser } from "@/lib/auth/require-user";
import { canManageProducts } from "@/lib/auth/roles";
import { ActionFeedback } from "@/components/dashboard/ActionFeedback";
import { DashboardActionButton } from "@/components/dashboard/DashboardActionButton";

export default async function ConversationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await requireDashboardUser();
  const canManage = canManageProducts(identity.role);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const detail = await getConversationDetailForRequest(id);
  if (!detail) notFound();
  const { conversation, product, messages, insights } = detail;
  const assistantTelemetry = [...messages].reverse().find((message) => message.role === "assistant");
  const transcript = messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");

  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <Link href="/dashboard/conversations" className="inline-flex items-center gap-2 text-sm font-semibold text-qahwa">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to conversations
      </Link>
      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-qahwa">Transcript</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{product?.name ?? conversation.productSlug}</h1>
          <p className="mt-2 text-stone-700">Anonymous visitor: {conversation.visitorRef}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyTranscriptButton transcript={transcript} />
          <StatusPill value={conversation.status} />
          <StatusPill value={conversation.fallbackReason} />
          <StatusPill value={conversation.detectedObjection} />
        </div>
      </div>
      <div id="dashboard-feedback" className="scroll-mt-6"><ActionFeedback query={query} successTitle="Conversation updated" /></div>

      <section className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Product context</h2>
          {product ? (
            <div className="mt-4">
              <Image
                src={product.imagePath}
                alt={product.name}
                width={1000}
                height={1200}
                className="aspect-[5/6] w-full rounded-md object-cover"
                unoptimized
              />
              <p className="mt-4 text-sm leading-6 text-stone-700">{product.shortDescription}</p>
              <dl className="mt-4 space-y-2 rounded-md border border-stone-200 p-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-stone-500">Language</dt><dd>{conversation.language || "Detected per message"}</dd></div><div className="flex justify-between gap-3"><dt className="text-stone-500">Provider / model</dt><dd className="text-right">{assistantTelemetry?.provider || "—"} / {assistantTelemetry?.model || "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-stone-500">Latency</dt><dd>{assistantTelemetry?.latencyMs ? `${assistantTelemetry.latencyMs} ms` : "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-stone-500">Token usage</dt><dd>{assistantTelemetry?.tokenUsage ? JSON.stringify(assistantTelemetry.tokenUsage) : "—"}</dd></div></dl>
              <div className="mt-4 grid gap-2">
                {product.keyFeatures.slice(0, 4).map((feature) => (
                  <div key={feature} className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Transcript</h2>
          <div className="mt-4 space-y-4" data-testid="conversation-transcript">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md p-4 ${message.role === "user" ? "bg-emerald-50" : "bg-stone-50"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs font-semibold uppercase text-stone-500">{message.role}</p>
                  {message.fallbackReason ? <StatusPill value={message.fallbackReason} /> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-800">{message.content}</p>
              </div>
            ))}
          </div>
          {canManage ? <div className="mt-6 rounded-md border border-stone-200 p-4">
            <h3 className="font-semibold text-ink">Answer quality review</h3>
            <p className="mt-2 text-sm text-stone-600">Merchant review signals are stored with the assistant message.</p>
            <div className="mt-3 flex gap-2">
              <form action={rateConversationAction}><input type="hidden" name="conversation_id" value={conversation.id}/><input type="hidden" name="rating" value="5"/><DashboardActionButton label="Helpful" pendingLabel="Saving rating…" className="focus-ring rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-qahwa" /></form>
              <form action={rateConversationAction}><input type="hidden" name="conversation_id" value={conversation.id}/><input type="hidden" name="rating" value="1"/><DashboardActionButton label="Needs review" pendingLabel="Saving rating…" className="focus-ring rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800" /></form>
            </div>
            <form action={addConversationNoteAction} className="mt-5"><input type="hidden" name="conversation_id" value={conversation.id}/><label className="text-sm font-semibold">Admin notes<textarea name="note" defaultValue={typeof conversation.metadata?.admin_note === "string" ? conversation.metadata.admin_note : ""} className="mt-2 min-h-20 w-full rounded-md border border-stone-300 p-3 font-normal"/></label><DashboardActionButton label="Save note" pendingLabel="Saving note…" className="mt-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold" /></form>
          </div> : <p className="mt-6 rounded-md border border-stone-200 p-4 text-sm text-stone-600">This transcript is read-only for your role.</p>}
        </div>
      </section>

      {canManage ? <section className="mt-6 rounded-md border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-ink">Create insight from review</h2><form action={createConversationInsightAction} className="mt-4 grid gap-4 md:grid-cols-2"><input type="hidden" name="conversation_id" value={conversation.id}/><label className="text-sm font-semibold">Title<input name="title" required minLength={3} className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"/></label><label className="text-sm font-semibold">Evidence<textarea name="content" required minLength={3} className="mt-2 min-h-20 w-full rounded-md border border-stone-300 p-3 font-normal"/></label><DashboardActionButton label="Create insight" pendingLabel="Creating insight…" className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" /></form></section> : null}

      <section className="mt-6 rounded-md border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Detected insights</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <div key={insight.id} className="rounded-md bg-stone-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium text-ink">{insight.title}</p>
                <StatusPill value={insight.type} />
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-700">{insight.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
    </DashboardTranslatedServer>
  );
}
