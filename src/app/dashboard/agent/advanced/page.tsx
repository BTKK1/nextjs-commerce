import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { requireAdvancedAgentUser } from "@/lib/auth/require-user";
import {
  getAgentAdminState,
  runtimeConfigForPromptVersion,
} from "@/lib/agent/config-repository";
import { getCurrentPromptCandidate } from "@/lib/agent/prompt-versioning";
import { validateSystemPrompt } from "@/lib/agent/prompt-validation";
import { savePromptDraftAction } from "@/app/dashboard/agent/actions";
import { NbehSelect } from "@/components/dashboard/NbehSelect";
import { ActionFeedback } from "@/components/dashboard/ActionFeedback";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { DraftSubmitButton } from "@/components/dashboard/DraftSubmitButton";
import { normalizeArabicDialect } from "@/lib/agent/welcome";

export const dynamic = "force-dynamic";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function lines(value: unknown): string {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .join("\n")
    : "";
}

export default async function AdvancedAgentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireAdvancedAgentUser();
  const [state, query] = await Promise.all([
    getAgentAdminState(identity),
    searchParams,
  ]);
  const currentDraft = getCurrentPromptCandidate(state.versions);
  const editing = currentDraft
    ? runtimeConfigForPromptVersion(state.active, currentDraft)
    : state.active;
  const validation = validateSystemPrompt(editing.systemPrompt);
  const advanced = record(editing.advancedSettings);
  const fallback = record(editing.fallbackPolicy);
  const objection = record(editing.objectionPolicy);
  const productContext = record(editing.productContextPolicy);
  const guardrail = editing.guardrails[0];
  const dialect = normalizeArabicDialect(advanced.arabic_tone);
  return (
    <DashboardTranslatedServer>
      <main className="p-4 sm:p-6 lg:p-8">
        <p className="text-sm font-semibold uppercase text-qahwa">
          Nbeh Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Edit Nbeh</h1>
        <p className="mt-2 max-w-3xl text-stone-700">
          Tell Nbeh how you want it to sell in plain language. Save a draft,
          test it, then publish it when you are happy with the replies.
        </p>
        <ActionFeedback
          query={query}
          warning={state.warning}
          successTitle="Draft saved"
          successAction={{
            href: "/dashboard/agent/qa",
            label: "Test and publish",
          }}
        />
        {identity.role === "founder" ? (
          <p className="mt-5 text-sm leading-6 text-stone-600">
            <strong className="text-[#4A21D6]">Founder scope:</strong> This page
            edits the Maison Vert demo agent.{" "}
            <Link
              href="/dashboard/platform"
              className="font-bold text-[#4A21D6] underline underline-offset-4"
            >
              Open Global Agent
            </Link>{" "}
            to change the baseline for every Nbeh agent.
          </p>
        ) : null}
        <div className="mt-5 flex gap-3 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            <strong>
              Your live agent stays unchanged until this draft is tested and
              published.
            </strong>{" "}
            Core safety and catalog-grounding protections remain active.
          </p>
        </div>
        <form
          action={savePromptDraftAction}
          className="mt-6 space-y-6 rounded-[20px] border border-stone-200 bg-white p-4 shadow-[0_16px_40px_-30px_rgba(11,14,18,.35)] sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                {currentDraft
                  ? "Edit your current draft"
                  : "Create your first draft"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                There is only one current draft. Saving again replaces the
                previous draft, while version history stays available.
              </p>
            </div>
            <StatusPill
              value={
                currentDraft
                  ? `Current draft v${currentDraft.version_number}`
                  : `Live v${state.active.versionNumber}`
              }
            />
          </div>
          <label className="block rounded-[18px] border border-[#DED8F5] bg-[#FBFAFF] p-5 text-sm font-semibold text-stone-800">
            What should Nbeh do differently?
            <span className="mt-1 block text-xs font-normal leading-5 text-stone-500">Write this like you are briefing a sales employee. Example: “Keep replies short, explain honest trade-offs, and ask only one useful question.”</span>
            <textarea name="developer_prompt" maxLength={8000} defaultValue={editing.developerPrompt ?? ""} placeholder="Describe the selling style, priorities, or boundaries you want…" className="focus-ring mt-3 min-h-40 w-full rounded-[14px] border border-stone-300 bg-white p-4 text-sm font-normal leading-6" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-[16px] border border-[#E5E0F3] bg-white p-4 text-sm font-semibold text-stone-800">How should Nbeh sound?<NbehSelect name="tone_preset" defaultValue={editing.tonePreset} ariaLabel="Tone preset" className="mt-2 font-normal" options={[{ value: "neutral_saudi", label: "Natural and helpful", description: "Clear, friendly, and balanced" }, { value: "warm_concise", label: "Warm and concise", description: "Friendly with shorter replies" }, { value: "consultative", label: "Consultative", description: "Helps shoppers compare needs and trade-offs" }]} /></label>
            <label className="rounded-[16px] border border-[#E5E0F3] bg-white p-4 text-sm font-semibold text-stone-800">Arabic dialect<NbehSelect name="arabic_tone" defaultValue={dialect} ariaLabel="Arabic dialect" className="mt-2 font-normal" options={[{ value: "white_saudi", label: "White Saudi Arabic", description: "Recommended · natural across Saudi Arabia" }, { value: "najdi", label: "Najdi" }, { value: "hijazi", label: "Hijazi" }, { value: "gulf", label: "Gulf" }, { value: "modern_standard", label: "Modern Standard Arabic" }]} /></label>
          </div>
          <details className="rounded-[16px] border border-stone-200 bg-stone-50/60 p-4">
            <summary className="cursor-pointer font-semibold text-ink">Advanced: core personality and safety rules</summary>
            <p className="mt-2 text-xs leading-5 text-stone-500">Most store owners never need this. Nbeh&apos;s mandatory accuracy and safety protections remain active.</p>
            <label className="mt-4 block text-sm font-semibold text-stone-800">Core rules<textarea name="system_prompt" required minLength={40} maxLength={16000} defaultValue={editing.systemPrompt} className="focus-ring mt-2 min-h-80 w-full rounded-[14px] border border-stone-300 bg-white p-4 font-mono text-sm leading-6" /></label>
          </details>
          <details className="rounded-[18px] border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold text-ink">Advanced behavior and safety controls <span className="ml-2 text-xs font-normal text-stone-500">Optional</span></summary>
            <p className="mt-2 text-sm text-stone-600">The recommended defaults are already selected. Open these controls only when you need a precise override.</p>
            <div className="mt-5 space-y-6">
          <fieldset className="rounded-md border border-stone-200 p-4">
            <legend className="px-2 text-sm font-semibold text-ink">
              Model and response behavior
            </legend>
            <p className="mb-4 text-sm text-stone-600">
              These controls shape reply style and length. Keep the defaults
              unless you have a specific behavior to test.
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm font-semibold">
                Language policy
                <NbehSelect
                  name="response_language_policy"
                  defaultValue={editing.responseLanguagePolicy}
                  ariaLabel="Language policy"
                  className="mt-2 font-normal"
                  options={[
                    { value: "match_shopper", label: "Match shopper" },
                    { value: "arabic_first", label: "Arabic first" },
                    { value: "english_first", label: "English first" },
                  ]}
                />
              </label>
              <label className="block text-sm font-semibold">
                Temperature{" "}
                <span className="block text-xs font-normal text-stone-500">
                  Lower is more consistent; higher is more varied.
                </span>
                <input
                  name="temperature"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={editing.temperature}
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Maximum tokens{" "}
                <span className="block text-xs font-normal text-stone-500">
                  Hard limit for one reply.
                </span>
                <input
                  name="max_tokens"
                  type="number"
                  min="64"
                  max="2000"
                  step="1"
                  defaultValue={editing.maxTokens}
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-semibold">
                Answer length guideline
                <input
                  name="answer_length"
                  defaultValue={String(
                    advanced.answer_length ?? "25-130 words",
                  )}
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                English tone rule
                <input
                  name="english_tone"
                  defaultValue={String(advanced.english_tone ?? "warm concise")}
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold">
              Tone examples (one per line)
              <textarea
                name="tone_examples"
                defaultValue={lines(advanced.tone_examples)}
                className="mt-2 min-h-24 w-full rounded-md border border-stone-300 p-3 font-normal"
              />
            </label>
          </fieldset>
          <fieldset className="rounded-md border border-stone-200 p-4">
            <legend className="px-2 text-sm font-semibold text-ink">
              Grounding, fallbacks, and objections
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold">
                Missing-information policy
                <input
                  name="missing_information_policy"
                  defaultValue={String(
                    fallback.missing_information ?? "merchant_or_product_page",
                  )}
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Objection handling instructions
                <textarea
                  name="objection_instructions"
                  defaultValue={String(
                    objection.instructions ??
                      "Acknowledge the concern, use catalog facts, explain honest trade-offs, and ask a useful next question.",
                  )}
                  className="mt-2 min-h-24 w-full rounded-md border border-stone-300 p-3 font-normal"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  name="current_product_only"
                  type="checkbox"
                  defaultChecked={
                    productContext.current_product_only_by_default !== false
                  }
                />
                Ground answers in the current product by default
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  name="related_products"
                  type="checkbox"
                  defaultChecked={productContext.related_products !== false}
                />
                Allow scoped related-product comparisons
              </label>
            </div>
          </fieldset>
          <fieldset className="rounded-md border border-stone-200 p-4">
            <legend className="px-2 text-sm font-semibold text-ink">
              Guardrails and fallback responses
            </legend>
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="block text-sm font-semibold">
                Allowed topics (one per line)
                <textarea
                  name="allowed_topics"
                  defaultValue={lines(guardrail?.allowed_topics)}
                  className="mt-2 min-h-36 w-full rounded-md border border-stone-300 p-3 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Blocked topics (one per line)
                <textarea
                  name="blocked_topics"
                  defaultValue={lines(guardrail?.blocked_topics)}
                  className="mt-2 min-h-36 w-full rounded-md border border-stone-300 p-3 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Blocked claims (one per line)
                <textarea
                  name="blocked_claims"
                  defaultValue={lines(guardrail?.blocked_claims)}
                  className="mt-2 min-h-36 w-full rounded-md border border-stone-300 p-3 font-normal"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold">
                English fallback
                <textarea
                  name="fallback_response_en"
                  defaultValue={guardrail?.fallback_response_en ?? ""}
                  className="mt-2 min-h-24 w-full rounded-md border border-stone-300 p-3 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Arabic fallback
                <textarea
                  name="fallback_response_ar"
                  dir="rtl"
                  defaultValue={guardrail?.fallback_response_ar ?? ""}
                  className="mt-2 min-h-24 w-full rounded-md border border-stone-300 p-3 font-normal"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold">
                Confidence threshold
                <input
                  name="confidence_threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={guardrail?.confidence_threshold ?? 0.55}
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                On violation
                <NbehSelect
                  name="on_violation"
                  defaultValue={guardrail?.on_violation ?? "fallback"}
                  ariaLabel="On violation"
                  className="mt-2 font-normal"
                  options={[
                    { value: "fallback", label: "Use fallback" },
                    { value: "refuse", label: "Refuse" },
                    { value: "escalate", label: "Escalate" },
                  ]}
                />
              </label>
            </div>
            <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-950">
              Prompt secrecy, payment-data protection, and catalog grounding
              remain enforced in code and cannot be disabled here.
            </p>
          </fieldset>
            </div>
          </details>
          <div className="rounded-md bg-stone-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">
                Current safety validation
              </h3>
              <StatusPill value={validation.valid ? "Passed" : "High Risk"} />
            </div>
            <ul className="mt-3 grid gap-2 text-sm text-stone-700 md:grid-cols-2">
              {validation.findings.length ? (
                validation.findings.map((finding) => (
                  <li key={finding.key}><span aria-hidden="true">•</span>{" "}<span>{finding.label}</span></li>
                ))
              ) : (
                <li>All required safety sections are present.</li>
              )}
            </ul>
          </div>
          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-[18px] border border-[#D8D1F3] bg-white/95 p-4 shadow-[0_18px_55px_-22px_rgba(35,20,90,.38)] backdrop-blur-xl sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm font-semibold text-stone-800">
              Name this change{" "}
              <span className="font-normal text-stone-500">
                · So you can recognize it later
              </span>
              <input
                name="change_note"
                required
                minLength={4}
                maxLength={240}
                placeholder="Example: Shortened replies and clarified price objections"
                className="focus-ring mt-2 w-full rounded-[12px] border border-stone-300 px-3 py-3 font-normal"
              />
            </label>
            <DraftSubmitButton />
          </div>
        </form>
      </main>
    </DashboardTranslatedServer>
  );
}
