import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { getConversationDetail } from "@/lib/dashboard/aggregation";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getConversationDetail(id);
  if (!detail) notFound();
  const { conversation, product, messages, insights } = detail;

  return (
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
          <StatusPill value={conversation.status} />
          <StatusPill value={conversation.fallbackReason} />
          <StatusPill value={conversation.detectedObjection} />
        </div>
      </div>

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
          <div className="mt-6 rounded-md border border-stone-200 p-4">
            <h3 className="font-semibold text-ink">Answer quality review</h3>
            <p className="mt-2 text-sm text-stone-600">Demo controls for merchant review signals.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-qahwa">
                <Check className="h-4 w-4" aria-hidden="true" />
                Helpful
              </button>
              <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                <X className="h-4 w-4" aria-hidden="true" />
                Needs review
              </button>
            </div>
          </div>
        </div>
      </section>

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
  );
}
