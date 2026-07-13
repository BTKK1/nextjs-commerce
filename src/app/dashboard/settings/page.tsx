import { ShieldCheck } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { getModelConfig } from "@/lib/ai/model-config";
import { getDashboardOverview } from "@/lib/dashboard/aggregation";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const overview = getDashboardOverview();
  const modelConfig = getModelConfig();

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Agent and demo settings</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Read-only showcase controls for tone, retention, guardrails, model mode, and demo status.
        </p>
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Agent mode</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-600">Mode</dt>
              <dd>
                <StatusPill value={modelConfig.mode} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-600">Model</dt>
              <dd className="font-medium text-ink">{modelConfig.model}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-600">Config source</dt>
              <dd className="font-medium text-ink">{modelConfig.source}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-600">Tone</dt>
              <dd className="font-medium text-ink">Neutral English</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-600">Retention display</dt>
              <dd className="font-medium text-ink">{overview.settings.retentionDays} demo days</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Privacy-aware demo posture</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
            <p>Visitors use anonymous references only.</p>
            <p>No payment credentials, admin credentials, or personal data are requested.</p>
            <p>Service-role keys are server-only and never exposed to client code.</p>
            <p>Local JSON persistence is for demo use; Supabase env placeholders are documented for production.</p>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-md border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-qahwa" aria-hidden="true" />
          <h2 className="font-semibold text-ink">Guardrails</h2>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {overview.guardrails.map((guardrail) => (
            <div key={guardrail.id} className="rounded-md bg-stone-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-medium text-ink">{guardrail.name}</h3>
                <StatusPill value={guardrail.enabled ? "enabled" : "disabled"} />
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-700">{guardrail.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
