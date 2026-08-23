import Link from "next/link";
import { Activity, Bot, FileClock, ShieldCheck } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { requireAdvancedAgentUser } from "@/lib/auth/require-user";
import { getAgentAdminState } from "@/lib/agent/config-repository";
import { getDashboardOverviewForRequest } from "@/lib/dashboard/server";
import { getCurrentPromptCandidate } from "@/lib/agent/prompt-versioning";

export const dynamic = "force-dynamic";

export default async function AgentSettingsPage() {
  const identity = await requireAdvancedAgentUser();
  const [state, overview] = await Promise.all([
    getAgentAdminState(identity),
    getDashboardOverviewForRequest(),
  ]);
  const currentDraft = getCurrentPromptCandidate(state.versions);
  const verificationRuns = state.qaRuns.filter(
    (run) => String(run.status) !== "playground_saved",
  );
  const latestQa = currentDraft
    ? verificationRuns.find((run) => run.prompt_version_id === currentDraft.id)
    : verificationRuns[0];
  return (
    <DashboardTranslatedServer>
      <main className="p-4 sm:p-6 lg:p-8">
        <p className="text-sm font-semibold uppercase text-qahwa">
          Nbeh Settings
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold text-ink">
              Nbeh for {overview.merchant.name}
            </h1>
            <p className="mt-2 max-w-3xl text-stone-700">
              Published behavior, model routing, safety posture, and QA
              readiness for this merchant&apos;s live Nbeh product-page
              assistant.
            </p>
          </div>
          <Link
            href={
              currentDraft ? "/dashboard/agent/qa" : "/dashboard/agent/advanced"
            }
            className="focus-ring rounded-[13px] bg-[#5B2EFF] px-4 py-2.5 text-sm font-bold text-white"
          >
            {currentDraft ? "Continue current draft" : "Edit agent"}
          </Link>
        </div>
        {currentDraft ? (
          <section className="mt-6 flex flex-col justify-between gap-4 rounded-[18px] border border-[#CFC6F6] bg-[#F7F5FF] p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5B2EFF]">
                Your current draft · Version {currentDraft.version_number}
              </p>
              <h2 className="mt-2 text-lg font-bold text-ink">
                {currentDraft.change_note || "Unpublished agent changes"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                This is the only draft in progress. Test it, then publish it
                when it passes.
              </p>
            </div>
            <Link
              href="/dashboard/agent/qa"
              className="rounded-[12px] bg-white px-4 py-2.5 text-center text-sm font-bold text-[#4A21D6] shadow-sm"
            >
              Test and publish
            </Link>
          </section>
        ) : null}
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: Bot,
              label: "Active version",
              value: `v${state.active.versionNumber}`,
              badge: state.active.status,
            },
            {
              icon: Activity,
              label: "Model",
              value: state.active.modelName,
              badge: state.active.modelProvider,
            },
            {
              icon: ShieldCheck,
              label: "Guardrails",
              value: `${state.active.guardrails.length || 1} policy set`,
              badge: "Active",
            },
            {
              icon: FileClock,
              label: "Latest QA",
              value: latestQa
                ? `${latestQa.average_score ?? 0}/100`
                : "Not run",
              badge: String(latestQa?.status ?? "Needs QA"),
            },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-md border border-stone-200 bg-white p-5 shadow-sm"
            >
              <item.icon className="h-5 w-5 text-qahwa" aria-hidden="true" />
              <p className="mt-4 text-sm text-stone-600">{item.label}</p>
              <p className="mt-1 truncate text-lg font-semibold text-ink">
                {item.value}
              </p>
              <div className="mt-3">
                <StatusPill value={item.badge} />
              </div>
            </article>
          ))}
        </section>
        <section className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold text-ink">
                Current active system prompt
              </h2>
              <StatusPill value={state.active.source} />
            </div>
            <p className="mt-4 max-h-48 overflow-hidden whitespace-pre-wrap rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-700">
              {state.active.systemPrompt}
            </p>
            <p className="mt-3 text-xs text-stone-500">
              The public widget never receives this prompt. It is loaded only
              inside the server-side agent runtime.
            </p>
          </div>
          <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-ink">Behavior</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Tone</dt>
                <dd className="font-medium">
                  {state.active.tonePreset.replaceAll("_", " ")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Language</dt>
                <dd className="font-medium">
                  {state.active.responseLanguagePolicy.replaceAll("_", " ")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Temperature</dt>
                <dd className="font-medium">{state.active.temperature}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Max tokens</dt>
                <dd className="font-medium">{state.active.maxTokens}</dd>
              </div>
            </dl>
            <div className="mt-6 grid gap-2">
              <Link
                href="/dashboard/agent/versions"
                className="rounded-md border border-stone-300 px-3 py-2 text-center text-sm font-semibold"
              >
                Prompt Versions
              </Link>
              <Link
                href="/dashboard/agent/qa"
                className="rounded-md border border-stone-300 px-3 py-2 text-center text-sm font-semibold"
              >
                Agent QA
              </Link>
              <Link
                href="/dashboard/agent/playground"
                className="rounded-md border border-stone-300 px-3 py-2 text-center text-sm font-semibold"
              >
                Playground
              </Link>
            </div>
          </div>
        </section>
      </main>
    </DashboardTranslatedServer>
  );
}
