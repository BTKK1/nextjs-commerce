import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CheckCircle2, Crown, ExternalLink, Gauge, ShieldCheck, Sparkles, Store, TriangleAlert } from "lucide-react";
import { requireDashboardUser } from "@/lib/auth/require-user";
import { canManageGlobalAgent } from "@/lib/auth/roles";
import { readGlobalAgentConfig } from "@/lib/agent/global-config";
import { GlobalAgentForm } from "@/components/dashboard/GlobalAgentForm";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { ActionFeedback } from "@/components/dashboard/ActionFeedback";
import { loadBetaReadiness } from "@/lib/ops/beta-readiness";

export const dynamic = "force-dynamic";

export default async function PlatformControlPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await requireDashboardUser();
  if (!canManageGlobalAgent(identity.role)) redirect("/dashboard");
  const [config, query, readiness] = await Promise.all([readGlobalAgentConfig(), searchParams, loadBetaReadiness()]);
  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#5B2EFF]"><Crown className="h-4 w-4" />Founder control</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Global Nbeh agent</h1>
          <p className="mt-2 max-w-3xl text-stone-600">This baseline prompt and model apply to every Nbeh agent. Merchant-specific product context remains isolated per store.</p>
          <div id="dashboard-feedback" className="scroll-mt-6"><ActionFeedback query={query} successTitle="Global agent updated" successAction={{ href: "/store", label: "Test in demo store" }} /></div>
        </div>
        <Link href="/store" className="inline-flex items-center gap-2 rounded-xl bg-[#5B2EFF] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,46,255,.22)] hover:bg-[#4A21D6]">View demo store <ExternalLink className="h-4 w-4" /></Link>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5"><Crown className="h-5 w-5 text-[#5B2EFF]" /><p className="mt-3 font-semibold">Top-level authority</p><p className="mt-1 text-sm text-stone-600">Includes every merchant-owner capability plus global model and prompt control.</p></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><Sparkles className="h-5 w-5 text-[#5B2EFF]" /><p className="mt-3 font-semibold">All Nbeh agents</p><p className="mt-1 text-sm text-stone-600">Published here as the shared Nbeh personality before store product data is added.</p></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><ShieldCheck className="h-5 w-5 text-emerald-600" /><p className="mt-3 font-semibold">Hard guardrails remain</p><p className="mt-1 text-sm text-stone-600">Grounding, prompt secrecy, and payment-data protections cannot be disabled.</p></div>
      </div>

      <section className="mt-7 overflow-hidden rounded-[24px] border border-[#DED8F5] bg-white shadow-[0_22px_60px_-42px_rgba(54,31,144,.55)]" data-testid="beta-readiness">
        <div className="flex flex-col justify-between gap-4 border-b border-[#E9E4F7] bg-[radial-gradient(600px_240px_at_100%_0%,rgba(91,46,255,.13),transparent_68%),#FCFBFF] p-5 sm:flex-row sm:items-start sm:p-7">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#5B2EFF]"><Gauge className="h-4 w-4" />MVP beta readiness</div>
            <h2 className="mt-2 text-2xl font-bold text-[#17131F]">{readiness.technicalReady ? "Ready for controlled beta" : "Production work still required"}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#676171]">This gate measures tenant isolation, product grounding, reliability, answer quality, and shopper interaction.</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${readiness.technicalReady ? "border-[#B8E4CD] bg-[#E7F7EF] text-[#056442]" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {readiness.technicalReady ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
            {readiness.technicalReady ? "All technical gates passed" : `${readiness.checks.filter((check) => !check.passed).length} gate(s) need attention`}
          </span>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-7">
          <div className="rounded-2xl border border-[#E8E4F2] bg-[#FCFBFF] p-4"><Store className="h-4 w-4 text-[#5B2EFF]" /><p className="mt-3 text-2xl font-bold">{readiness.activeMerchantCount}<span className="text-sm font-semibold text-[#686271]"> / {readiness.capacityTarget}</span></p><p className="mt-1 text-xs text-[#676171]">Active merchant workspaces</p></div>
          <div className="rounded-2xl border border-[#E8E4F2] bg-[#FCFBFF] p-4"><Activity className="h-4 w-4 text-[#5B2EFF]" /><p className="mt-3 text-2xl font-bold">{readiness.interactingMerchantCount}<span className="text-sm font-semibold text-[#686271]"> / {readiness.pilotInteractionTarget}</span></p><p className="mt-1 text-xs text-[#676171]">Merchants with shopper interaction in 30 days</p></div>
          <div className="rounded-2xl border border-[#E8E4F2] bg-[#FCFBFF] p-4"><Sparkles className="h-4 w-4 text-[#5B2EFF]" /><p className="mt-3 text-2xl font-bold">{readiness.groundedAnswerRateLast24Hours == null ? "—" : `${readiness.groundedAnswerRateLast24Hours}%`}</p><p className="mt-1 text-xs text-[#676171]">Grounded answer rate · 24h</p></div>
          <div className="rounded-2xl border border-[#E8E4F2] bg-[#FCFBFF] p-4"><Gauge className="h-4 w-4 text-[#5B2EFF]" /><p className="mt-3 text-2xl font-bold">{readiness.medianLatencyMsLast24Hours == null ? "—" : `${(readiness.medianLatencyMsLast24Hours / 1000).toFixed(1)}s`}</p><p className="mt-1 text-xs text-[#676171]">Median agent response · 24h</p></div>
        </div>

        <div className="grid gap-3 border-t border-[#EEEAF6] p-5 sm:grid-cols-2 sm:p-7">
          {readiness.checks.map((check) => <div key={check.id} data-readiness-check={check.id} data-passed={check.passed ? "true" : "false"} className={`rounded-2xl border p-4 ${check.passed ? "border-emerald-100 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}><div className="flex items-start gap-3">{check.passed ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}<div><p className="font-bold text-[#292530]">{check.label}</p><p className="mt-1 text-sm leading-5 text-[#676171]">{check.detail}</p></div></div></div>)}
        </div>
      </section>

      <GlobalAgentForm config={config} />
    </main>
    </DashboardTranslatedServer>
  );
}
