"use client";

import Link from "next/link";
import { Bot, ExternalLink, MessageSquareText, PackageSearch, Send, Sparkles, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { detectLanguage } from "@/lib/agent/language";
import { NbehSelect } from "@/components/dashboard/NbehSelect";
import { DashboardTranslated } from "@/components/dashboard/DashboardLocale";

interface AgentResult {
  answer: string;
  fallbackReason: string | null;
  guardrailResult: string;
  model: string | null;
  version: number;
}

interface PlaygroundResult {
  active: AgentResult;
  draft: AgentResult;
  context: { product: string; source: string; fields: string[] };
  generatedInsights: Record<string, string | null>;
}

interface AgentPlaygroundProps {
  products: Array<{ slug: string; name: string; category: string; priceLabel: string }>;
  draftVersionId?: string;
  draftVersion?: number;
}

const emptyProduct = { slug: "", name: "No product", category: "", priceLabel: "" };

export function AgentPlayground({ products, draftVersionId, draftVersion }: AgentPlaygroundProps) {
  const [productSlug, setProductSlug] = useState(products[0]?.slug ?? "");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCaseId, setSavedCaseId] = useState("");
  const hasDraft = Boolean(draftVersionId && draftVersion);
  const locale = detectLanguage(message);
  const product = useMemo(() => products.find((item) => item.slug === productSlug) ?? products[0] ?? emptyProduct, [productSlug, products]);

  function changeProduct(nextSlug: string) {
    setProductSlug(nextSlug);
    setResult(null);
    setError("");
    setSavedCaseId("");
  }

  async function run() {
    setPending(true);
    setError("");
    setResult(null);
    setSavedCaseId("");
    try {
      const response = await fetch("/api/dashboard/agent/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ productSlug: product.slug, locale, message, draftVersionId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Playground request failed");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Playground request failed");
    } finally {
      setPending(false);
    }
  }

  async function saveQaCase() {
    if (!result) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/agent/playground", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          productSlug: product.slug,
          locale,
          message,
          draftVersionId,
          activeAnswer: result.active.answer,
          draftAnswer: result.draft.answer,
          generatedInsights: result.generatedInsights,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Saving the QA case failed");
      setSavedCaseId(payload.qaCaseId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saving the QA case failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardTranslated>
      <section className="mt-8 overflow-hidden rounded-[24px] border border-[#E1DDF0] bg-white shadow-[0_18px_50px_rgba(38,27,77,0.08)]">
        <div className="flex flex-col gap-4 border-b border-[#E9E5F3] bg-[linear-gradient(120deg,#F7F4FF,#FCFBFF)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#5B2EFF] text-white shadow-[0_10px_24px_rgba(91,46,255,0.22)]">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#17131F]">Choose the product page to test</p>
              <p className="mt-0.5 text-xs text-[#737080]">Both agents receive the exact same selected product context.</p>
            </div>
          </div>
          <Link href={`/store/products/${product.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-[13px] border border-[#CEC5F5] bg-white px-4 py-2.5 text-sm font-bold text-[#5B2EFF] transition hover:-translate-y-0.5 hover:border-[#5B2EFF] hover:shadow-sm">
            Open product page <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="p-5 lg:p-6">
          <div className="mb-5 rounded-[18px] border border-[#E3DDF8] bg-[linear-gradient(135deg,#FFFFFF,#F8F5FF)] p-4 shadow-[0_14px_34px_-26px_rgba(91,46,255,.5)]">
            <label className="flex items-center gap-2 text-sm font-bold text-[#17131F]">
              <PackageSearch className="h-4 w-4 text-[#5B2EFF]" aria-hidden="true" /> Product context
            </label>
            <NbehSelect
              value={product.slug}
              onValueChange={changeProduct}
              ariaLabel="Product context"
              className="mt-2"
              buttonClassName="min-h-[58px] bg-white"
              menuClassName="max-h-80"
              options={products.map((item) => ({ value: item.slug, label: item.name, description: `${item.category} · ${item.priceLabel}` }))}
            />
            <p className="mt-2 text-xs leading-5 text-[#777281]">Live Agent and Draft Agent will answer as if the shopper is viewing this product page.</p>
          </div>
          <label htmlFor="playground-message" className="text-sm font-bold text-[#17131F]">Shopper message</label>
          <div className="relative mt-2">
            <textarea
              id="playground-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask a product question, test an objection, or try a difficult shopper request…"
              className="min-h-32 w-full resize-y rounded-[18px] border border-[#D8D4E4] bg-[#FCFBFE] p-4 pr-14 text-sm leading-6 text-[#17131F] outline-none transition placeholder:text-[#9A96A6] focus:border-[#8064F4] focus:bg-white focus:ring-4 focus:ring-[#5B2EFF]/10"
            />
            <MessageSquareText className="pointer-events-none absolute right-4 top-4 h-5 w-5 text-[#A59EBD]" aria-hidden="true" />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={pending || !message.trim()}
              onClick={run}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#5B2EFF] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(91,46,255,0.24)] transition hover:-translate-y-0.5 hover:bg-[#4F26E8] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? <><Sparkles className="h-4 w-4 animate-pulse" /> Both agents are replying…</> : <><Send className="h-4 w-4" /> Test both agents</>}
            </button>
          </div>
          {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5B2EFF]">Side-by-side agent test</p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[#17131F]">Two agents. One shopper question.</h2>
          </div>
          <p className="max-w-md text-sm text-[#737080]">Compare what shoppers see now with what they would see after your draft is published.</p>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <AgentCard
            kind="live"
            title="Live Agent"
            subtitle="What shoppers see now"
            version={result?.active.version}
            shopperMessage={result ? message : undefined}
            result={result?.active}
            locale={locale}
          />
          <AgentCard
            kind="draft"
            title="Draft Agent"
            subtitle={hasDraft ? "Your unpublished changes" : "No unpublished draft yet"}
            version={result?.draft.version ?? draftVersion}
            shopperMessage={result && hasDraft ? message : undefined}
            result={hasDraft ? result?.draft : undefined}
            locale={locale}
            unavailable={!hasDraft}
          />
        </div>
      </section>

      {result ? (
        <>
          <details className="mt-6 rounded-[18px] border border-[#E1DDF0] bg-white p-5 text-sm text-[#656170]">
            <summary className="cursor-pointer font-bold text-[#292530]">Test details and grounding</summary>
            <div className="mt-4 grid gap-5 border-t border-[#EEEAF5] pt-4 md:grid-cols-2">
              <div><p className="font-bold text-[#292530]">Context used</p><p className="mt-2">{result.context.product} · {result.context.source}</p><p className="mt-1 text-xs text-[#8B8795]">{result.context.fields.join(" · ")}</p></div>
              <div><p className="font-bold text-[#292530]">Generated signals</p><pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(result.generatedInsights, null, 2)}</pre></div>
            </div>
          </details>
          <div className="mt-5 flex items-center gap-3">
            <button type="button" onClick={saveQaCase} disabled={saving || Boolean(savedCaseId) || !hasDraft} className="rounded-[13px] border border-[#D2CCE4] bg-white px-4 py-2.5 text-sm font-bold text-[#383242] transition hover:border-[#8064F4] hover:text-[#5B2EFF] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Saving QA case…" : savedCaseId ? "QA case saved" : hasDraft ? "Save comparison as QA case" : "Create a draft to save a comparison"}
            </button>
            {savedCaseId ? <span className="text-xs text-[#8B8795]">Case {savedCaseId}</span> : null}
          </div>
        </>
      ) : null}
    </DashboardTranslated>
  );
}

function AgentCard({ kind, title, subtitle, version, shopperMessage, result, locale, unavailable = false }: { kind: "live" | "draft"; title: string; subtitle: string; version?: number; shopperMessage?: string; result?: AgentResult; locale: "en" | "ar"; unavailable?: boolean }) {
  const live = kind === "live";
  return (
    <DashboardTranslated><article className={`overflow-hidden rounded-[24px] border bg-white shadow-[0_18px_45px_rgba(38,27,77,0.07)] ${live ? "border-[#D8D2EE]" : "border-[#E1D7FF]"}`}>
      <header className={`flex items-center justify-between border-b px-5 py-4 ${live ? "border-[#E8E4F0] bg-[#FBFAFD]" : "border-[#E8E0FF] bg-[#F8F5FF]"}`}>
        <div className="flex items-center gap-3">
          <span className={`relative flex h-11 w-11 items-center justify-center rounded-[15px] text-white ${live ? "bg-[#17131F]" : "bg-[#5B2EFF]"}`}>
            <Bot className="h-5 w-5" aria-hidden="true" />
            <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white ${live ? "bg-[#22C55E]" : unavailable ? "bg-[#B7B3C0]" : "bg-[#A78BFA]"}`} />
          </span>
          <div>
            <h3 className="font-bold text-[#17131F]">{title}</h3>
            <p className="mt-0.5 text-xs text-[#6B6572]">{subtitle}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${live ? "bg-[#E7F7EF] text-[#056442]" : unavailable ? "bg-[#ECEAF0] text-[#686271]" : "bg-[#EDE7FF] text-[#4A21D6]"}`}>
          {live ? `Live · v${version ?? "—"}` : unavailable ? "No draft" : `Draft · v${version ?? "—"}`}
        </span>
      </header>

      <div className="flex min-h-[330px] flex-col bg-[radial-gradient(circle_at_15%_0%,rgba(91,46,255,0.055),transparent_34%),#FCFBFD] p-5">
        {unavailable ? (
          <div className="m-auto max-w-sm text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEE9FF] text-[#5B2EFF]"><Sparkles className="h-5 w-5" /></span>
            <h4 className="mt-4 font-bold text-[#292530]">Draft Agent is waiting</h4>
            <p className="mt-2 text-sm leading-6 text-[#6B6572]">Save an unpublished version in Advanced settings. It will appear here as a second agent before anything reaches shoppers.</p>
            <Link href="/dashboard/agent/advanced" className="mt-4 inline-flex rounded-xl bg-[#5B2EFF] px-4 py-2.5 text-sm font-bold text-white">Create a draft</Link>
          </div>
        ) : result && shopperMessage ? (
          <div className={`flex flex-1 flex-col gap-4 ${locale === "ar" ? "text-right" : "text-left"}`} dir={locale === "ar" ? "rtl" : "ltr"}>
            <div className="ml-auto max-w-[84%] rounded-[18px_18px_5px_18px] bg-[#EAE5F8] px-4 py-3 text-sm leading-6 text-[#393344]">{shopperMessage}</div>
            <div className="flex max-w-[92%] items-start gap-2.5">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[#5B2EFF] text-white"><Bot className="h-3.5 w-3.5" /></span>
              <div className="rounded-[5px_18px_18px_18px] border border-[#E5E0EE] bg-white px-4 py-3 text-sm leading-6 text-[#292530] shadow-sm">{result.answer}</div>
            </div>
            <div className="mt-auto border-t border-[#EAE6F0] pt-3 text-[11px] text-[#686271]">Model: {result.model ?? "Guardrail"} · Safety: {result.guardrailResult} · Fallback: {result.fallbackReason ?? "None"}</div>
          </div>
        ) : (
          <div className="m-auto max-w-sm text-center">
            <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${live ? "bg-[#EDEAF3] text-[#292530]" : "bg-[#EEE9FF] text-[#5B2EFF]"}`}><MessageSquareText className="h-5 w-5" /></span>
            <p className="mt-4 text-sm leading-6 text-[#6B6572]">Send one shopper message above. This agent’s full reply will appear here like a real conversation.</p>
          </div>
        )}
      </div>
    </article></DashboardTranslated>
  );
}
