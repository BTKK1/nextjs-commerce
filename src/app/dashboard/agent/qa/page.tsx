import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { requireAdvancedAgentUser } from "@/lib/auth/require-user";
import { getAgentAdminState } from "@/lib/agent/config-repository";
import { getCurrentPromptCandidate } from "@/lib/agent/prompt-versioning";
import {
  publishPromptVersionAction,
  runPromptQaAction,
} from "@/app/dashboard/agent/actions";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { dashboardDateLocale, getDashboardLocale } from "@/lib/dashboard/i18n";
import { ActionFeedback } from "@/components/dashboard/ActionFeedback";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { DashboardActionButton } from "@/components/dashboard/DashboardActionButton";

export const dynamic = "force-dynamic";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function WorkflowStep({
  label,
  complete,
  current,
}: {
  label: string;
  complete: boolean;
  current?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[14px] border px-3 py-2.5 ${current ? "border-[#B9A8FF] bg-[#F4F1FF] text-[#4A21D6]" : "border-stone-200 bg-white text-stone-600"}`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${complete ? "bg-emerald-600 text-white" : current ? "bg-[#5B2EFF] text-white" : "bg-stone-100 text-stone-400"}`}
      >
        {complete ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Circle className="h-3 w-3" aria-hidden="true" />
        )}
      </span>
      <span className="text-sm font-bold">{label}</span>
    </div>
  );
}

export default async function AgentQaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireAdvancedAgentUser();
  const [state, locale, query] = await Promise.all([
    getAgentAdminState(identity),
    getDashboardLocale(),
    searchParams,
  ]);
  const candidate = getCurrentPromptCandidate(state.versions);
  const test = record(candidate?.test_result);
  const qaPassed = candidate?.status === "tested" && test.passed === true;
  const qaFailed = test.passed === false;
  const verificationRuns = state.qaRuns.filter(
    (run) => String(run.status) !== "playground_saved",
  );
  const playgroundComparisons = state.qaRuns.filter(
    (run) => String(run.status) === "playground_saved",
  );

  return (
    <DashboardTranslatedServer>
      <main className="p-4 sm:p-6 lg:p-8">
        <p className="text-sm font-semibold uppercase text-qahwa">
          Agent settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">
          Test and publish
        </h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          One current draft moves through three steps. You never need to choose
          between drafts.
        </p>
        <ActionFeedback
          query={query}
          warning={state.warning}
          successTitle={qaPassed ? "Your draft passed" : "Check complete"}
        />

        <section
          aria-label="Draft publishing progress"
          className="mt-7 grid gap-2 sm:grid-cols-3"
        >
          <WorkflowStep
            label="1. Edit"
            complete={Boolean(candidate)}
            current={!candidate}
          />
          <WorkflowStep
            label="2. Test"
            complete={qaPassed}
            current={Boolean(candidate) && !qaPassed}
          />
          <WorkflowStep
            label="3. Publish"
            complete={!candidate}
            current={qaPassed}
          />
        </section>

        <section className="mt-5 rounded-[22px] border border-[#DDD6F7] bg-white p-5 shadow-[0_18px_45px_-34px_rgba(50,28,130,.55)] sm:p-6">
          {!candidate ? (
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-ink">
                  Your live agent is up to date
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  There is no unpublished change. Edit the agent when you want
                  to make a new one.
                </p>
              </div>
              <Link
                href="/dashboard/agent/advanced"
                className="rounded-[13px] bg-[#5B2EFF] px-5 py-3 text-center text-sm font-bold text-white"
              >
                Edit agent
              </Link>
            </div>
          ) : (
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5B2EFF]">
                    Your current draft
                  </p>
                  <StatusPill value={`Version ${candidate.version_number}`} />
                </div>
                <h2 className="mt-3 text-xl font-bold text-ink">
                  {candidate.change_note || "Unpublished agent changes"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  {qaPassed
                    ? "The safety and quality checks passed. Publish this draft to make it the agent shoppers use."
                    : qaFailed
                      ? "The checks found issues. Edit the draft, then run the checks again."
                      : "Run the checks once. If they pass, the publish button appears here."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {qaPassed ? (
                  <form action={publishPromptVersionAction}>
                    <input
                      type="hidden"
                      name="version_id"
                      value={candidate.id}
                    />
                    <ConfirmSubmitButton
                      confirmation={`Publish version ${candidate.version_number} as the live agent? This immediately changes shopper responses.`}
                      pendingLabel="Publishing agent…"
                      className="rounded-[13px] bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
                    >
                      Publish to shoppers
                    </ConfirmSubmitButton>
                  </form>
                ) : qaFailed ? (
                  <>
                    <Link
                      href="/dashboard/agent/advanced"
                      className="rounded-[13px] bg-[#5B2EFF] px-5 py-3 text-center text-sm font-bold text-white"
                    >
                      Edit draft
                    </Link>
                    <form action={runPromptQaAction}>
                      <input
                        type="hidden"
                        name="version_id"
                        value={candidate.id}
                      />
                      <DashboardActionButton label="Run checks again" pendingLabel="Running checks…" className="rounded-[13px] border border-[#CFC6F6] bg-white px-5 py-3 text-sm font-bold text-[#4A21D6]" />
                    </form>
                  </>
                ) : (
                  <form action={runPromptQaAction}>
                    <input
                      type="hidden"
                      name="version_id"
                      value={candidate.id}
                    />
                    <DashboardActionButton label="Test current draft" pendingLabel="Testing draft…" className="rounded-[13px] bg-[#5B2EFF] px-5 py-3 text-sm font-bold text-white" />
                  </form>
                )}
              </div>
            </div>
          )}
        </section>

        <details className="mt-8 rounded-[18px] border border-stone-200 bg-white p-5">
          <summary className="cursor-pointer font-bold text-ink">
            Test history
          </summary>
          <p className="mt-2 text-sm text-stone-600">
            Open this only when you need detailed QA evidence.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <caption className="sr-only">
                Recent agent quality-assurance runs
              </caption>
              <thead className="border-b text-xs uppercase text-stone-500">
                <tr>
                  <th className="py-3">Status</th>
                  <th>Score</th>
                  <th>Hard failures</th>
                  <th>Completed</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {verificationRuns.map((run) => (
                  <tr
                    key={String(run.id)}
                    className="border-b border-stone-100 align-top"
                  >
                    <td className="py-3">
                      <StatusPill value={String(run.status)} />
                    </td>
                    <td className="py-3">{String(run.average_score ?? "—")}</td>
                    <td className="py-3">{String(run.hard_failures ?? 0)}</td>
                    <td className="whitespace-nowrap py-3">
                      {run.completed_at
                        ? new Date(String(run.completed_at)).toLocaleString(
                            dashboardDateLocale(locale),
                          )
                        : "Pending"}
                    </td>
                    <td className="py-3">
                      <details>
                        <summary className="cursor-pointer font-semibold text-qahwa">
                          View report
                        </summary>
                        <pre className="mt-2 max-h-64 max-w-lg overflow-auto whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs text-stone-700">
                          {JSON.stringify(run.report_json ?? {}, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!verificationRuns.length ? (
              <p className="py-8 text-center text-sm text-stone-600">
                No publishing QA runs yet.
              </p>
            ) : null}
          </div>
        </details>

        {playgroundComparisons.length ? (
          <details className="mt-4 rounded-[18px] border border-[#DDD6F7] bg-[#FAF9FF] p-5">
            <summary className="cursor-pointer font-bold text-ink">
              Saved Playground comparisons
            </summary>
            <p className="mt-2 text-sm text-stone-600">
              These are saved side-by-side examples, not publishing QA scores.
            </p>
            <div className="mt-4 space-y-2">
              {playgroundComparisons.map((run) => (
                <details
                  key={String(run.id)}
                  className="rounded-[14px] border border-[#E4E0F5] bg-white p-4"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-[#4A21D6]">
                    Saved comparison ·{" "}
                    {run.completed_at
                      ? new Date(String(run.completed_at)).toLocaleString(
                          dashboardDateLocale(locale),
                        )
                      : "Pending"}
                  </summary>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs text-stone-700">
                    {JSON.stringify(run.report_json ?? {}, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </details>
        ) : null}
      </main>
    </DashboardTranslatedServer>
  );
}
