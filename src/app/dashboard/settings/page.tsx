import Link from "next/link";
import { MessageSquareText, MonitorSmartphone, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { getModelConfig } from "@/lib/ai/model-config";
import { getDashboardOverviewForRequest } from "@/lib/dashboard/server";
import { loadDashboardTeam } from "@/lib/dashboard/data";
import { resolveDataBackend } from "@/lib/backend/mode";
import { requireDashboardAdminUser } from "@/lib/auth/require-user";
import { updateDashboardPreferencesAction, updateWidgetPreferencesAction } from "@/app/dashboard/settings/actions";
import { DEFAULT_WIDGET_PREFERENCES } from "@/lib/widget/preferences";
import { getActiveAgentConfig } from "@/lib/agent/config-repository";
import { normalizeArabicDialect } from "@/lib/agent/welcome";
import { NbehSelect } from "@/components/dashboard/NbehSelect";
import { dashboardDateLocale, getDashboardLocale } from "@/lib/dashboard/i18n";
import { ActionFeedback } from "@/components/dashboard/ActionFeedback";
import { SettingsSubmitButton } from "@/components/dashboard/SettingsSubmitButton";
import { WidgetSettingsPreview } from "@/components/dashboard/WidgetSettingsPreview";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireDashboardAdminUser();
  const [overview, team, locale, query, activeAgent] = await Promise.all([getDashboardOverviewForRequest(), loadDashboardTeam(identity), getDashboardLocale(), searchParams, getActiveAgentConfig(identity.merchantId).catch(() => null)]);
  const modelConfig = getModelConfig();
  const backendMode = resolveDataBackend();
  const dialect = normalizeArabicDialect(activeAgent?.advancedSettings.arabic_tone);
  const toneLabel = ({ neutral_saudi: "Natural and helpful", warm_concise: "Warm and concise", consultative: "Consultative" } as Record<string, string>)[activeAgent?.tonePreset ?? "neutral_saudi"] ?? "Natural and helpful";
  const dialectLabel = ({ white_saudi: "White Saudi Arabic", najdi: "Najdi", hijazi: "Hijazi", gulf: "Gulf", modern_standard: "Modern Standard Arabic" } as const)[dialect];
  const widgetSettings = {
    positionAr: overview.settings.widgetPositionAr ?? DEFAULT_WIDGET_PREFERENCES.positionAr,
    positionEn: overview.settings.widgetPositionEn ?? DEFAULT_WIDGET_PREFERENCES.positionEn,
    teaserMessageAr: overview.settings.widgetTeaserMessageAr ?? DEFAULT_WIDGET_PREFERENCES.teaserMessageAr,
    teaserMessageEn: overview.settings.widgetTeaserMessageEn ?? DEFAULT_WIDGET_PREFERENCES.teaserMessageEn,
    autoPopupEnabled: overview.settings.widgetAutoPopupEnabled ?? DEFAULT_WIDGET_PREFERENCES.autoPopupEnabled,
    autoPopupDelaySeconds: overview.settings.widgetAutoPopupDelaySeconds ?? DEFAULT_WIDGET_PREFERENCES.autoPopupDelaySeconds,
  };

  return (
    <DashboardTranslatedServer>
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-qahwa">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Merchant and Nbeh settings</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Manage the store name, conversation retention, team access, and the safety rules that protect shopper answers.
        </p>
        <div id="settings-feedback" className="scroll-mt-6">
          <ActionFeedback
            query={query}
            successTitle={query.notice === "Widget settings saved" ? "Widget settings saved" : "Settings saved"}
            successAction={query.notice === "Widget settings saved" ? { href: "/store", label: "Open demo store" } : undefined}
          />
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-[24px] border border-[#DED8F5] bg-white shadow-[0_18px_50px_-36px_rgba(91,46,255,.45)]">
        <div className="border-b border-[#ECE8F8] bg-[radial-gradient(600px_180px_at_100%_0%,rgba(91,46,255,.13),transparent_65%),#FBFAFF] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#5B2EFF] text-white shadow-[0_10px_24px_rgba(91,46,255,.24)]"><MonitorSmartphone className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B2EFF]">Storefront widget</p>
              <h2 className="mt-1 text-xl font-bold text-[#17131F]">Control where Nbeh appears</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#676171]">Nbeh appears only on product pages. Its welcome automatically uses the exact product name and follows your live tone and Arabic dialect.</p>
            </div>
          </div>
        </div>
        <form id="storefront-widget-settings" action={updateWidgetPreferencesAction} className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4 rounded-[18px] border border-[#E3DDF8] bg-[#FAF8FF] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#5B2EFF] shadow-sm"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div><p className="font-bold text-[#292530]">Welcome message is automatic</p><p className="mt-1 text-sm leading-6 text-[#676171]"><span>Tone:</span>{" "}<span>{toneLabel}</span>{" "}<span>· Arabic dialect:</span>{" "}<span>{dialectLabel}</span>. <span>The Salla product name is inserted automatically.</span></p></div></div>
            <Link href="/dashboard/agent/advanced" className="shrink-0 rounded-[12px] border border-[#CFC6F6] bg-white px-4 py-2.5 text-center text-sm font-bold text-[#4A21D6]">Change tone or dialect</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-semibold text-[#292530]">Position in Arabic<NbehSelect name="widget_position_ar" defaultValue={widgetSettings.positionAr} ariaLabel="Position in Arabic" className="mt-2 font-normal" options={[{ value: "right", label: "Right" }, { value: "left", label: "Left" }]} /></label>
            <label className="block text-sm font-semibold text-[#292530]">Position in English<NbehSelect name="widget_position_en" defaultValue={widgetSettings.positionEn} ariaLabel="Position in English" className="mt-2 font-normal" options={[{ value: "right", label: "Right" }, { value: "left", label: "Left" }]} /></label>
            <label className="block text-sm font-semibold text-[#292530]">Auto popup<NbehSelect name="widget_auto_popup_enabled" defaultValue={widgetSettings.autoPopupEnabled ? "enabled" : "disabled"} ariaLabel="Auto popup" className="mt-2 font-normal" options={[{ value: "enabled", label: "Enabled" }, { value: "disabled", label: "Disabled" }]} /></label>
            <label className="block text-sm font-semibold text-[#292530]">Popup delay in seconds<div className="relative mt-2"><Timer className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B2EFF]" aria-hidden="true" /><input name="widget_auto_popup_delay_seconds" type="number" min="0" max="60" step="1" defaultValue={widgetSettings.autoPopupDelaySeconds} className="min-h-11 w-full rounded-[14px] border border-[#D6D9E1] bg-white py-2.5 pl-10 pr-3 text-sm font-normal outline-none transition focus:border-[#5B2EFF] focus:ring-4 focus:ring-[#5B2EFF]/10" /></div></label>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block text-sm font-semibold text-[#292530]">Message above the widget in Arabic<span className="mt-1 block text-xs font-normal leading-5 text-[#746C82]">Shown while the chat is closed. Leave it empty to hide it.</span><input name="widget_teaser_message_ar" maxLength={120} defaultValue={widgetSettings.teaserMessageAr} dir="rtl" placeholder="محتار؟ اسأل نبيه عن المنتج" className="mt-2 min-h-11 w-full rounded-[14px] border border-[#D6D9E1] bg-white px-3.5 py-2.5 text-sm font-normal outline-none transition focus:border-[#5B2EFF] focus:ring-4 focus:ring-[#5B2EFF]/10" /></label>
            <label className="block text-sm font-semibold text-[#292530]">Message above the widget in English<span className="mt-1 block text-xs font-normal leading-5 text-[#746C82]">Shown while the chat is closed. Leave it empty to hide it.</span><input name="widget_teaser_message_en" maxLength={120} defaultValue={widgetSettings.teaserMessageEn} dir="ltr" placeholder="Need help choosing? Ask Nbeh" className="mt-2 min-h-11 w-full rounded-[14px] border border-[#D6D9E1] bg-white px-3.5 py-2.5 text-sm font-normal outline-none transition focus:border-[#5B2EFF] focus:ring-4 focus:ring-[#5B2EFF]/10" /></label>
          </div>
          <WidgetSettingsPreview formId="storefront-widget-settings" dashboardLocale={locale} initialSettings={widgetSettings} />
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#EFECF7] pt-5">
            <p className="flex items-center gap-2 text-sm text-[#676171]"><MessageSquareText className="h-4 w-4 text-[#5B2EFF]" aria-hidden="true" />These display settings apply only while a shopper is viewing a product page.</p>
            <SettingsSubmitButton label="Save widget settings" pendingLabel="Saving widget settings…" />
          </div>
        </form>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Agent mode</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-600">Data backend</dt>
              <dd><StatusPill value={backendMode} /></dd>
            </div>
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
              <dd className="text-right font-medium text-ink">Neutral Saudi tone, matches shopper language</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-600">Retention period</dt>
              <dd className="font-medium text-ink">{overview.settings.retentionDays} days</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Privacy and data posture</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
            <p>Visitors use anonymous references only.</p>
            <p>No payment credentials, admin credentials, or personal data are requested.</p>
            <p>Service-role keys are server-only and never exposed to client code.</p>
            <p>{backendMode === "supabase" ? "Dashboard records are currently loaded from merchant-scoped Supabase tables." : "Local JSON persistence is enabled for offline development only."}</p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2"><div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-ink">Merchant settings</h2><p className="mt-2 text-sm text-stone-600">Changes are merchant-scoped and recorded in the audit log.</p><form action={updateDashboardPreferencesAction} className="mt-4 space-y-4"><label className="block text-sm font-semibold">Merchant<input readOnly value={overview.merchant.name} className="mt-2 w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">Retention days<input name="retention_days" type="number" min="7" max="365" step="1" defaultValue={overview.settings.retentionDays} className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">Dashboard refresh<NbehSelect name="refresh_interval" defaultValue={overview.settings.refreshInterval ?? "manual"} ariaLabel="Dashboard refresh" className="mt-2 font-normal" options={[{ value: "manual", label: "Manual" }, { value: "5m", label: "Every 5 minutes" }, { value: "15m", label: "Every 15 minutes" }, { value: "30m", label: "Every 30 minutes" }]} /></label><SettingsSubmitButton label="Save preferences" pendingLabel="Saving preferences…" variant="dark" /></form></div><div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-ink">Team users and roles</h2><div className="mt-4 space-y-3">{team.map((member) => <div key={member.userId} className="flex items-center justify-between gap-4 rounded-md bg-stone-50 p-3 text-sm"><div><p className="font-medium text-ink">User …{member.userId.slice(-8)}</p><p className="text-xs text-stone-500">Added {new Date(member.createdAt).toLocaleDateString(dashboardDateLocale(locale))}</p></div><StatusPill value={member.role}/></div>)}{!team.length ? <p className="text-sm text-stone-600">No permanent team membership has been configured yet.</p> : null}</div></div></section>

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
    </DashboardTranslatedServer>
  );
}
