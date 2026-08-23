import Link from "next/link";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { requireAdvancedAgentUser } from "@/lib/auth/require-user";
import { getAgentAdminState } from "@/lib/agent/config-repository";
import {
  publishPromptVersionAction,
  rollbackPromptVersionAction,
  runPromptQaAction,
} from "@/app/dashboard/agent/actions";
import {
  comparePromptText,
  getCurrentPromptCandidate,
} from "@/lib/agent/prompt-versioning";
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

export default async function PromptVersionsPage({
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
  const current = getCurrentPromptCandidate(state.versions);
  const activeRow = state.versions.find(
    (version) => version.id === state.active.promptVersionId,
  );
  const history = state.versions.filter(
    (version) => version.id !== current?.id && version.id !== activeRow?.id,
  );
  const currentTest = record(current?.test_result);
  const qaPassed = current?.status === "tested" && currentTest.passed === true;
  const qaFailed = currentTest.passed === false;
  const canOverride = identity.role === "owner" || identity.role === "founder";
  const comparison = current
    ? comparePromptText(state.active.systemPrompt, current.system_prompt)
    : null;

  return (
    <DashboardTranslatedServer>
      <main className="p-4 sm:p-6 lg:p-8">
        <p className="text-sm font-semibold uppercase text-qahwa">
          Agent settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Versions</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          The current draft is always shown first. Older work stays in version
          history, so you never have to choose which draft to continue.
        </p>
        <ActionFeedback
          query={query}
          warning={state.warning}
          successTitle="Live agent updated"
        />

        <section className="mt-7 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
              Live now
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-ink">
                Version {state.active.versionNumber}
              </h2>
              <StatusPill value="Active" />
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              This is the agent shoppers currently use. Draft changes cannot
              affect it until you publish.
            </p>
          </article>

          <article className="rounded-[20px] border border-[#CFC6F6] bg-white p-5 shadow-[0_18px_45px_-34px_rgba(50,28,130,.55)]">
            {current ? (
              <>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5B2EFF]">
                      Your current draft
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-ink">
                        Version {current.version_number}
                      </h2>
                      <StatusPill
                        value={
                          qaPassed
                            ? "Ready to publish"
                            : qaFailed
                              ? "Needs changes"
                              : "Needs testing"
                        }
                      />
                    </div>
                    <p className="mt-2 text-sm text-stone-600">
                      {current.change_note || "No change note"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {qaPassed ? (
                      <form action={publishPromptVersionAction}>
                        <input
                          type="hidden"
                          name="version_id"
                          value={current.id}
                        />
                        <ConfirmSubmitButton
                          confirmation={`Publish version ${current.version_number} as the live agent? This immediately changes shopper responses.`}
                          pendingLabel="Publishing agent…"
                          className="rounded-[13px] bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
                        >
                          Publish to shoppers
                        </ConfirmSubmitButton>
                      </form>
                    ) : qaFailed ? (
                      <Link
                        href="/dashboard/agent/advanced"
                        className="rounded-[13px] bg-[#5B2EFF] px-4 py-2.5 text-sm font-bold text-white"
                      >
                        Edit draft
                      </Link>
                    ) : (
                      <form action={runPromptQaAction}>
                        <input
                          type="hidden"
                          name="version_id"
                          value={current.id}
                        />
                        <DashboardActionButton label="Test current draft" pendingLabel="Testing draft…" className="rounded-[13px] bg-[#5B2EFF] px-4 py-2.5 text-sm font-bold text-white" />
                      </form>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="rounded-[12px] bg-emerald-50 px-2 py-2 text-emerald-800">
                    1. Edited
                  </div>
                  <div
                    className={`rounded-[12px] px-2 py-2 ${qaPassed ? "bg-emerald-50 text-emerald-800" : "bg-[#F4F1FF] text-[#4A21D6]"}`}
                  >
                    2. {qaPassed ? "Tested" : "Test"}
                  </div>
                  <div
                    className={`rounded-[12px] px-2 py-2 ${qaPassed ? "bg-[#F4F1FF] text-[#4A21D6]" : "bg-stone-100 text-stone-700"}`}
                  >
                    3. Publish
                  </div>
                </div>

                <details className="mt-4 rounded-[14px] bg-stone-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Review what changed
                  </summary>
                  {comparison ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-stone-600 sm:grid-cols-3">
                      <p>
                        {comparison.changed
                          ? "Different from live"
                          : "Matches live"}
                      </p>
                      <p>{comparison.addedLines.length} added line(s)</p>
                      <p>{comparison.removedLines.length} removed line(s)</p>
                    </div>
                  ) : null}
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-stone-700">
                    {current.system_prompt}
                  </pre>
                </details>

                {!qaPassed && canOverride ? (
                  <details className="mt-4 border-t border-stone-200 pt-4">
                    <summary className="cursor-pointer text-xs font-bold text-amber-800">
                      Emergency override
                    </summary>
                    <p className="my-2 text-xs leading-5 text-stone-600">
                      Founder and owner only. Use this only when waiting for QA
                      would cause greater harm; the reason is recorded.
                    </p>
                    <form
                      action={publishPromptVersionAction}
                      className="flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        type="hidden"
                        name="version_id"
                        value={current.id}
                      />
                      <input
                        name="override_reason"
                        required
                        minLength={12}
                        aria-label={`Owner override reason for version ${current.version_number}`}
                        placeholder="Why is emergency publishing required?"
                        className="rounded-[12px] border border-amber-300 px-3 py-2 text-sm sm:w-80"
                      />
                      <ConfirmSubmitButton
                        confirmation={`Emergency-publish version ${current.version_number}? This immediately changes shopper responses and records your reason.`}
                        pendingLabel="Publishing agent…"
                        className="rounded-[12px] border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950"
                      >
                        Emergency publish
                      </ConfirmSubmitButton>
                    </form>
                  </details>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5B2EFF]">
                    No unpublished change
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-ink">
                    Your live agent is up to date
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Create a draft only when you want to change how the agent
                    behaves.
                  </p>
                </div>
                <Link
                  href="/dashboard/agent/advanced"
                  className="rounded-[13px] bg-[#5B2EFF] px-4 py-2.5 text-center text-sm font-bold text-white"
                >
                  Edit agent
                </Link>
              </div>
            )}
          </article>
        </section>

        <details className="mt-6 rounded-[18px] border border-stone-200 bg-white p-5">
          <summary className="cursor-pointer font-bold text-ink">
            Version history ({history.length})
          </summary>
          <p className="mt-2 text-sm text-stone-600">
            Older drafts are kept for reference. Only previously published
            versions can be restored.
          </p>
          <div className="mt-4 space-y-3">
            {history.map((version) => {
              const canRestore =
                version.status === "published" || version.status === "rollback";
              return (
                <article
                  key={version.id}
                  className="rounded-[14px] border border-stone-200 bg-stone-50/70 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink">
                          Version {version.version_number}
                        </h3>
                        <StatusPill
                          value={
                            version.status === "draft" ||
                            version.status === "tested"
                              ? "Superseded"
                              : version.status
                          }
                        />
                      </div>
                      <p className="mt-1 text-sm text-stone-600">
                        {version.change_note || "No change note"}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        Created{" "}
                        {new Date(version.created_at).toLocaleString(
                          dashboardDateLocale(locale),
                        )}
                      </p>
                    </div>
                    {canRestore ? (
                      <form
                        action={rollbackPromptVersionAction}
                        className="flex flex-wrap gap-2"
                      >
                        <input
                          type="hidden"
                          name="version_id"
                          value={version.id}
                        />
                        <input
                          name="reason"
                          required
                          minLength={8}
                          aria-label={`Rollback reason for version ${version.version_number}`}
                          placeholder="Why restore this version?"
                          className="w-48 rounded-[12px] border border-stone-300 px-3 py-2 text-sm"
                        />
                        <ConfirmSubmitButton
                          confirmation={`Restore version ${version.version_number} as the live agent? The reason will be recorded in the audit log.`}
                          pendingLabel="Restoring version…"
                          className="rounded-[12px] border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950"
                        >
                          Restore
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[#4A21D6]">
                      View prompt
                    </summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-[12px] bg-white p-3 text-xs leading-5 text-stone-700">
                      {version.system_prompt}
                    </pre>
                  </details>
                </article>
              );
            })}
            {!history.length ? (
              <p className="rounded-[14px] bg-stone-50 p-5 text-center text-sm text-stone-600">
                No older versions yet.
              </p>
            ) : null}
          </div>
        </details>
      </main>
    </DashboardTranslatedServer>
  );
}
