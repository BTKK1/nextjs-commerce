"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/server";
import { requireAdvancedAgentUser } from "@/lib/auth/require-user";
import { validateSystemPrompt } from "@/lib/agent/prompt-validation";
import {
  getCurrentPromptCandidate,
  nextPromptVersionNumber,
} from "@/lib/agent/prompt-versioning";
import {
  finiteNumber,
  linesToList,
  readVersionedAgentSettings,
} from "@/lib/agent/config-snapshot";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  getAgentAdminState,
  runtimeConfigForPromptVersion,
} from "@/lib/agent/config-repository";
import { runDashboardPromptQa } from "@/lib/agent/dashboard-qa";
import { loadDashboardDatabase } from "@/lib/dashboard/data";
import { resolveDataBackend } from "@/lib/backend/mode";
import { mutateLocalAgentAdminState } from "@/lib/agent/local-admin-store";
import type { Json, PromptVersionRow } from "@/lib/supabase/types";

function value(formData: FormData, key: string): string {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function submittedListOr(
  formData: FormData,
  key: string,
  fallback: unknown,
): string[] {
  const submitted = value(formData, key);
  return submitted ? linesToList(submitted) : stringArray(fallback);
}

function isMissingAtomicDraftRpc(error: unknown): boolean {
  const details = error && typeof error === "object"
    ? error as Record<string, unknown>
    : {};
  const code = typeof details.code === "string" ? details.code : "";
  const message = typeof details.message === "string" ? details.message : "";
  return code === "PGRST202"
    || code === "42883"
    || /schema cache/i.test(message);
}

function finish(message: string, target = "/dashboard/agent/advanced"): never {
  revalidatePath("/dashboard/agent", "layout");
  redirect(`${target}?notice=${encodeURIComponent(message)}`);
}

function fail(message: string, target = "/dashboard/agent/advanced"): never {
  revalidatePath("/dashboard/agent", "layout");
  redirect(`${target}?error=${encodeURIComponent(message)}`);
}

function localAudit(
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  return {
    id: randomUUID(),
    action,
    entity_type: entityType,
    entity_id: entityId,
    actor_type: "founder",
    created_at: new Date().toISOString(),
    details_json: details,
  };
}

async function activeConfig(merchantId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "Active agent configuration was not found. Run the Supabase seed first.",
    );
  const { data: guardrail, error: guardrailError } = await supabase
    .from("guardrails")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("agent_config_id", data.id)
    .limit(1)
    .maybeSingle();
  if (guardrailError) throw guardrailError;
  return { supabase, config: data, guardrail };
}

export async function savePromptDraftAction(formData: FormData) {
  const identity = await requireAdvancedAgentUser();
  const systemPrompt = value(formData, "system_prompt");
  const developerPrompt = value(formData, "developer_prompt");
  const changeNote = value(formData, "change_note");
  if (systemPrompt.length < 40 || systemPrompt.length > 16_000)
    fail("Draft prompt must be between 40 and 16,000 characters.");
  if (changeNote.length < 4) fail("A short change note is required.");

  if (resolveDataBackend() === "local") {
    let savedVersionNumber = 0;
    try {
      const state = await getAgentAdminState(identity);
      const active = state.active;
      const currentCandidate = getCurrentPromptCandidate(state.versions);
      const editing = currentCandidate
        ? runtimeConfigForPromptVersion(active, currentCandidate)
        : active;
      const guardrail = editing.guardrails[0];
      const versionNumber = nextPromptVersionNumber(state.versions);
      const versionId = randomUUID();
      const validation = validateSystemPrompt(systemPrompt);
      const onViolationValue = value(formData, "on_violation");
      const onViolation =
        onViolationValue === "refuse" || onViolationValue === "escalate"
          ? onViolationValue
          : "fallback";
      const now = new Date().toISOString();
      const version: PromptVersionRow = {
        id: versionId,
        agent_config_id: active.configId,
        merchant_id: identity.merchantId,
        version_number: versionNumber,
        title: `Draft v${versionNumber}`,
        system_prompt: systemPrompt,
        developer_prompt: developerPrompt || null,
        change_note: changeNote,
        test_result: JSON.parse(
          JSON.stringify({
            validation,
            qa_required: true,
            config_snapshot: {
              tone_preset: value(formData, "tone_preset") || editing.tonePreset,
              response_language_policy:
                value(formData, "response_language_policy") ||
                editing.responseLanguagePolicy,
              temperature: finiteNumber(
                value(formData, "temperature"),
                0,
                1,
                editing.temperature,
              ),
              max_tokens: Math.round(
                finiteNumber(
                  value(formData, "max_tokens"),
                  64,
                  2000,
                  editing.maxTokens,
                ),
              ),
              product_context_policy: {
                ...editing.productContextPolicy,
                current_product_only_by_default:
                  formData.get("current_product_only") === "on",
                related_products: formData.get("related_products") === "on",
              },
              fallback_policy: {
                ...editing.fallbackPolicy,
                missing_information:
                  value(formData, "missing_information_policy") ||
                  String(editing.fallbackPolicy.missing_information ?? "merchant_or_product_page"),
              },
              safety_policy: {
                ...editing.safetyPolicy,
                hard_code_guardrails: true,
                prompt_secrecy: true,
                no_payment_data: true,
              },
              objection_policy: {
                ...editing.objectionPolicy,
                honest_tradeoffs: true,
                useful_next_question: true,
                instructions:
                  value(formData, "objection_instructions") ||
                  String(editing.objectionPolicy.instructions ?? ""),
              },
              advanced_settings: {
                ...editing.advancedSettings,
                answer_length:
                  value(formData, "answer_length") ||
                  String(editing.advancedSettings.answer_length ?? "25-130 words"),
                arabic_tone:
                  value(formData, "arabic_tone") ||
                  String(editing.advancedSettings.arabic_tone ?? "neutral Saudi"),
                english_tone:
                  value(formData, "english_tone") ||
                  String(editing.advancedSettings.english_tone ?? "warm concise"),
                tone_examples: submittedListOr(
                  formData,
                  "tone_examples",
                  editing.advancedSettings.tone_examples,
                ),
              },
            },
            guardrail_snapshot: {
              allowed_topics: submittedListOr(formData, "allowed_topics", guardrail?.allowed_topics),
              blocked_topics: submittedListOr(formData, "blocked_topics", guardrail?.blocked_topics),
              blocked_claims: submittedListOr(formData, "blocked_claims", guardrail?.blocked_claims),
              fallback_response_ar:
                value(formData, "fallback_response_ar") ||
                guardrail?.fallback_response_ar ||
                "",
              fallback_response_en:
                value(formData, "fallback_response_en") ||
                guardrail?.fallback_response_en ||
                "",
              confidence_threshold: finiteNumber(
                value(formData, "confidence_threshold"),
                0,
                1,
                Number(guardrail?.confidence_threshold ?? 0.55),
              ),
              on_violation: onViolation,
            },
          }),
        ) as Json,
        status: "draft",
        created_by: identity.userId,
        published_by: null,
        created_at: now,
        published_at: null,
      };
      await mutateLocalAgentAdminState(identity.merchantId, (stored) => {
        for (const existing of stored.versions) {
          if (existing.status === "draft" || existing.status === "tested")
            existing.status = "archived";
        }
        stored.versions.unshift(version);
        stored.auditLogs.unshift(
          localAudit("prompt_draft_saved", "prompt_version", versionId, {
            version_number: versionNumber,
            change_note: changeNote,
          }),
        );
      });
      savedVersionNumber = versionNumber;
    } catch (error) {
      console.error(
        "[nbeh] save_prompt_draft_failed",
        error instanceof Error ? error.message : "unknown error",
      );
      fail(
        "The draft could not be saved. Your changes are still in the form; please retry.",
      );
    }
    finish(
      `Draft version ${savedVersionNumber} saved. Run QA before publishing.`,
    );
  }

  try {
    const { supabase, config, guardrail } = await activeConfig(
      identity.merchantId,
    );
    const { data: versions, error: versionsError } = await supabase
      .from("prompt_versions")
      .select("*")
      .eq("agent_config_id", config.id);
    if (versionsError) throw versionsError;
    const currentCandidate = getCurrentPromptCandidate(
      (versions ?? []) as PromptVersionRow[],
    );
    const inherited = currentCandidate
      ? readVersionedAgentSettings(currentCandidate.test_result)
      : null;
    const baseConfig = inherited?.config_snapshot ?? {
      tone_preset: config.tone_preset,
      response_language_policy: config.response_language_policy,
      temperature: Number(config.temperature),
      max_tokens: Number(config.max_tokens),
      product_context_policy: record(config.product_context_policy),
      fallback_policy: record(config.fallback_policy),
      safety_policy: record(config.safety_policy),
      objection_policy: record(config.objection_policy),
      advanced_settings: record(config.advanced_settings),
    };
    const baseGuardrail = inherited?.guardrail_snapshot ?? {
      allowed_topics: stringArray(guardrail?.allowed_topics),
      blocked_topics: stringArray(guardrail?.blocked_topics),
      blocked_claims: stringArray(guardrail?.blocked_claims),
      fallback_response_ar: guardrail?.fallback_response_ar ?? "",
      fallback_response_en: guardrail?.fallback_response_en ?? "",
      confidence_threshold: Number(guardrail?.confidence_threshold ?? 0.55),
      on_violation: guardrail?.on_violation ?? "fallback",
    };
    const validation = validateSystemPrompt(systemPrompt);
    const onViolationValue = value(formData, "on_violation");
    const onViolation =
      onViolationValue === "refuse" || onViolationValue === "escalate"
        ? onViolationValue
          : baseGuardrail.on_violation;
    const configSnapshot = {
      tone_preset: value(formData, "tone_preset") || baseConfig.tone_preset,
      response_language_policy:
        value(formData, "response_language_policy") ||
        baseConfig.response_language_policy,
      temperature: finiteNumber(
        value(formData, "temperature"),
        0,
        1,
        Number(baseConfig.temperature),
      ),
      max_tokens: Math.round(
        finiteNumber(
          value(formData, "max_tokens"),
          64,
          2000,
          Number(baseConfig.max_tokens),
        ),
      ),
      product_context_policy: {
        ...record(baseConfig.product_context_policy),
        current_product_only_by_default:
          formData.get("current_product_only") === "on",
        related_products: formData.get("related_products") === "on",
      },
      fallback_policy: {
        ...record(baseConfig.fallback_policy),
        missing_information:
          value(formData, "missing_information_policy") ||
          String(record(baseConfig.fallback_policy).missing_information ?? "merchant_or_product_page"),
      },
      safety_policy: {
        ...record(baseConfig.safety_policy),
        hard_code_guardrails: true,
        prompt_secrecy: true,
        no_payment_data: true,
      },
      objection_policy: {
        ...record(baseConfig.objection_policy),
        honest_tradeoffs: true,
        useful_next_question: true,
        instructions:
          value(formData, "objection_instructions") ||
          String(record(baseConfig.objection_policy).instructions ?? ""),
      },
      advanced_settings: {
        ...record(baseConfig.advanced_settings),
        answer_length:
          value(formData, "answer_length") ||
          String(record(baseConfig.advanced_settings).answer_length ?? "25-130 words"),
        arabic_tone:
          value(formData, "arabic_tone") ||
          String(record(baseConfig.advanced_settings).arabic_tone ?? "neutral Saudi"),
        english_tone:
          value(formData, "english_tone") ||
          String(record(baseConfig.advanced_settings).english_tone ?? "warm concise"),
        tone_examples: submittedListOr(
          formData,
          "tone_examples",
          record(baseConfig.advanced_settings).tone_examples,
        ),
      },
    };
    const guardrailSnapshot = {
      allowed_topics: submittedListOr(formData, "allowed_topics", baseGuardrail.allowed_topics),
      blocked_topics: submittedListOr(formData, "blocked_topics", baseGuardrail.blocked_topics),
      blocked_claims: submittedListOr(formData, "blocked_claims", baseGuardrail.blocked_claims),
      fallback_response_ar:
        value(formData, "fallback_response_ar") ||
        baseGuardrail.fallback_response_ar ||
        "",
      fallback_response_en:
        value(formData, "fallback_response_en") ||
        baseGuardrail.fallback_response_en ||
        "",
      confidence_threshold: finiteNumber(
        value(formData, "confidence_threshold"),
        0,
        1,
        Number(baseGuardrail.confidence_threshold),
      ),
      on_violation: onViolation,
    };
    let { data: savedDraft, error } = await supabase.rpc(
      "save_prompt_draft_atomic",
      {
        target_merchant_id: identity.merchantId,
        target_config_id: config.id,
        target_system_prompt: systemPrompt,
        target_developer_prompt: developerPrompt || null,
        target_change_note: changeNote,
        target_test_result: {
        validation,
        qa_required: true,
        config_snapshot: configSnapshot,
        guardrail_snapshot: guardrailSnapshot,
        },
        actor_user_id: identity.userId,
      },
    );
    if (error && isMissingAtomicDraftRpc(error)) {
      // Keep the currently deployed dashboard usable while the matching
      // migration rolls through an environment. The RPC becomes the only path
      // as soon as the database schema is current.
      const versionNumber = nextPromptVersionNumber(
        (versions ?? []) as PromptVersionRow[],
      );
      const versionId = randomUUID();
      const { error: insertError } = await supabase.from("prompt_versions").insert({
        id: versionId,
        agent_config_id: config.id,
        merchant_id: identity.merchantId,
        version_number: versionNumber,
        title: `Draft v${versionNumber}`,
        system_prompt: systemPrompt,
        developer_prompt: developerPrompt || null,
        change_note: changeNote,
        test_result: {
          validation,
          qa_required: true,
          config_snapshot: configSnapshot,
          guardrail_snapshot: guardrailSnapshot,
        },
        status: "draft",
        created_by: identity.userId,
      });
      if (insertError) throw insertError;
      const { error: supersedeError } = await supabase
        .from("prompt_versions")
        .update({ status: "archived" })
        .eq("agent_config_id", config.id)
        .eq("merchant_id", identity.merchantId)
        .in("status", ["draft", "tested"])
        .neq("id", versionId);
      if (supersedeError) throw supersedeError;
      await writeAuditLog({
        merchantId: identity.merchantId,
        actorUserId: identity.userId,
        action: "prompt_draft_saved",
        entityType: "prompt_version",
        entityId: versionId,
        after: { version_number: versionNumber, validation },
        details: {
          change_note: changeNote,
          versioned_agent_settings: true,
          atomic_migration_pending: true,
        },
      });
      savedDraft = [{ version_id: versionId, version_number: versionNumber }];
      error = null;
    }
    if (error) throw error;
    const savedRow = Array.isArray(savedDraft) ? savedDraft[0] : savedDraft;
    const versionNumber = Number(
      savedRow && typeof savedRow === "object"
        ? (savedRow as Record<string, unknown>).version_number
        : 0,
    );
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      throw new Error("Atomic draft save returned an invalid version number.");
    }
    finish(`Draft version ${versionNumber} saved. Run QA before publishing.`);
  } catch (error) {
    console.error(
      "[nbeh] save_prompt_draft_failed",
      error instanceof Error ? error.message : "unknown error",
    );
    fail(
      "The draft could not be saved. Your live agent was not changed; please retry.",
    );
  }
}

export async function runPromptQaAction(formData: FormData) {
  const identity = await requireAdvancedAgentUser();
  const versionId = value(formData, "version_id");
  if (resolveDataBackend() === "local") {
    let resultMessage = "QA could not run.";
    try {
      const [state, dashboardDatabase] = await Promise.all([
        getAgentAdminState(identity),
        loadDashboardDatabase(),
      ]);
      const current = getCurrentPromptCandidate(state.versions);
      if (!current || current.id !== versionId)
        throw new Error("Only the current draft can be tested.");
      const version = state.versions.find((item) => item.id === versionId);
      if (!version) throw new Error("Prompt version was not found.");
      const validation = validateSystemPrompt(version.system_prompt);
      const runtime = runtimeConfigForPromptVersion(state.active, version);
      const cases = await runDashboardPromptQa(runtime, dashboardDatabase);
      const hardFailures =
        validation.hardFailures +
        cases.reduce((count, item) => count + item.hardFailures.length, 0);
      const averageScore = cases.length
        ? cases.reduce((sum, item) => sum + item.score, 0) / cases.length
        : 0;
      const passed =
        validation.valid &&
        hardFailures === 0 &&
        cases.every((item) => item.passed) &&
        averageScore >= 8;
      const report = {
        ...record(version.test_result),
        passed,
        hard_failures: hardFailures,
        validation,
        average_score: averageScore,
        checks: {
          unsupported_claims: cases.every(
            (item) =>
              !item.hardFailures.some((failure) =>
                failure.includes("unsupported"),
              ),
          ),
          prompt_injection: cases
            .filter(
              (item) =>
                item.scenario === "prompt_injection" ||
                item.scenario === "prompt_disclosure",
            )
            .every((item) => item.passed),
          fallback_behavior: cases
            .filter((item) => item.scenario === "missing_warranty")
            .every((item) => item.passed),
          arabic_tone: cases
            .filter((item) => item.language === "ar")
            .every((item) => item.passed),
          product_fact_accuracy: cases
            .filter((item) => item.scenario.includes("product_fact"))
            .every((item) => item.passed),
        },
        cases: cases.map((item) => ({
          scenario: item.scenario,
          language: item.language,
          score: item.score,
          passed: item.passed,
          hard_failures: item.hardFailures,
          findings: item.findings,
        })),
        note: "Live eight-case publishing-gate matrix using the exact draft prompt and versioned behavior settings.",
      };
      const qaRunId = randomUUID();
      const now = new Date().toISOString();
      await mutateLocalAgentAdminState(identity.merchantId, (stored) => {
        const candidate = stored.versions.find((item) => item.id === versionId);
        if (!candidate) throw new Error("Prompt version was not found.");
        candidate.test_result = JSON.parse(JSON.stringify(report)) as Json;
        candidate.status = passed ? "tested" : "draft";
        stored.qaRuns.unshift({
          id: qaRunId,
          merchant_id: identity.merchantId,
          agent_config_id: state.active.configId,
          prompt_version_id: versionId,
          status: passed ? "passed" : "failed",
          total_conversations: cases.length,
          total_messages: cases.length * 2,
          average_score: Math.round(averageScore * 10) / 10,
          hard_failures: hardFailures,
          report_json: report,
          created_by: identity.userId,
          completed_at: now,
          created_at: now,
        });
        stored.auditLogs.unshift(
          localAudit("prompt_qa_run", "qa_run", qaRunId, {
            prompt_version_id: versionId,
            passed,
            hard_failures: hardFailures,
          }),
        );
      });
      resultMessage = passed
        ? `QA passed for version ${version.version_number}.`
        : `QA found ${hardFailures} hard failure(s).`;
    } catch (error) {
      console.error(
        "[nbeh] run_prompt_qa_failed",
        error instanceof Error ? error.message : "unknown error",
      );
      fail(
        "QA could not run right now. The draft is safe and unpublished.",
        "/dashboard/agent/qa",
      );
    }
    finish(resultMessage, "/dashboard/agent/qa");
  }
  try {
    const { supabase, config } = await activeConfig(identity.merchantId);
    const { data: version, error } = await supabase
      .from("prompt_versions")
      .select("*")
      .eq("id", versionId)
      .eq("merchant_id", identity.merchantId)
      .maybeSingle();
    if (error || !version) throw new Error("Prompt version was not found.");
    const validation = validateSystemPrompt(version.system_prompt);
    const [state, dashboardDatabase] = await Promise.all([
      getAgentAdminState(identity),
      loadDashboardDatabase(),
    ]);
    const current = getCurrentPromptCandidate(state.versions);
    if (!current || current.id !== versionId)
      throw new Error("Only the current draft can be tested.");
    const runtime = runtimeConfigForPromptVersion(state.active, version);
    const cases = await runDashboardPromptQa(runtime, dashboardDatabase);
    const caseHardFailures = cases.reduce(
      (count, item) => count + item.hardFailures.length,
      0,
    );
    const hardFailures = validation.hardFailures + caseHardFailures;
    const averageScore = cases.length
      ? cases.reduce((sum, item) => sum + item.score, 0) / cases.length
      : 0;
    const passed =
      validation.valid &&
      hardFailures === 0 &&
      cases.every((item) => item.passed) &&
      averageScore >= 8;
    const report = {
      ...record(version.test_result),
      passed,
      hard_failures: hardFailures,
      validation,
      average_score: averageScore,
      checks: {
        unsupported_claims: cases.every(
          (item) =>
            !item.hardFailures.some((failure) =>
              failure.includes("unsupported"),
            ),
        ),
        prompt_injection: cases
          .filter(
            (item) =>
              item.scenario === "prompt_injection" ||
              item.scenario === "prompt_disclosure",
          )
          .every((item) => item.passed),
        fallback_behavior: cases
          .filter((item) => item.scenario === "missing_warranty")
          .every((item) => item.passed),
        arabic_tone: cases
          .filter((item) => item.language === "ar")
          .every((item) => item.passed),
        product_fact_accuracy: cases
          .filter((item) => item.scenario.includes("product_fact"))
          .every((item) => item.passed),
      },
      cases: cases.map((item) => ({
        scenario: item.scenario,
        language: item.language,
        score: item.score,
        passed: item.passed,
        hard_failures: item.hardFailures,
        findings: item.findings,
      })),
      note: "Live eight-case publishing-gate matrix using the exact draft prompt and versioned behavior settings.",
    };
    const qaRunId = randomUUID();
    const { error: qaError } = await supabase.from("qa_runs").insert({
      id: qaRunId,
      merchant_id: identity.merchantId,
      agent_config_id: config.id,
      prompt_version_id: version.id,
      status: passed ? "passed" : "failed",
      total_conversations: cases.length,
      total_messages: cases.length * 2,
      average_score: Math.round(averageScore * 100) / 10,
      hard_failures: hardFailures,
      report_json: report,
      created_by: identity.userId,
      completed_at: new Date().toISOString(),
    });
    if (qaError) throw qaError;
    const { error: casesError } = await supabase.from("qa_cases").insert(
      cases.map((item) => ({
        id: randomUUID(),
        qa_run_id: qaRunId,
        merchant_id: identity.merchantId,
        product_id: item.productId,
        language: item.language,
        scenario: item.scenario,
        user_messages: [item.message],
        assistant_messages: [item.answer],
        score: item.score,
        hard_failures: item.hardFailures,
        findings: item.findings,
      })),
    );
    if (casesError) throw casesError;
    const { error: versionError } = await supabase
      .from("prompt_versions")
      .update({ test_result: report, status: passed ? "tested" : "draft" })
      .eq("id", version.id)
      .eq("merchant_id", identity.merchantId);
    if (versionError) throw versionError;
    await writeAuditLog({
      merchantId: identity.merchantId,
      actorUserId: identity.userId,
      action: "prompt_qa_run",
      entityType: "qa_run",
      entityId: qaRunId,
      details: {
        prompt_version_id: version.id,
        passed,
        hard_failures: hardFailures,
        cases: cases.length,
        average_score: averageScore,
      },
    });
    finish(
      passed
        ? `QA passed for version ${version.version_number}.`
        : `QA found ${hardFailures} hard failure(s).`,
      "/dashboard/agent/qa",
    );
  } catch (error) {
    console.error(
      "[nbeh] run_prompt_qa_failed",
      error instanceof Error ? error.message : "unknown error",
    );
    fail(
      "QA could not run right now. The draft is safe and unpublished.",
      "/dashboard/agent/qa",
    );
  }
}

export async function publishPromptVersionAction(formData: FormData) {
  const identity = await requireAdvancedAgentUser();
  const versionId = value(formData, "version_id");
  const overrideReason = value(formData, "override_reason");
  if (resolveDataBackend() === "local") {
    let resultMessage = "Version published.";
    try {
      const state = await getAgentAdminState(identity);
      const current = getCurrentPromptCandidate(state.versions);
      if (!current || current.id !== versionId)
        throw new Error("Only the current draft can be published.");
      const version = state.versions.find((item) => item.id === versionId);
      if (!version) throw new Error("Prompt version was not found.");
      const validation = validateSystemPrompt(version.system_prompt);
      const qa = state.qaRuns.find(
        (run) =>
          run.prompt_version_id === version.id &&
          run.status === "passed" &&
          Number(run.hard_failures) === 0,
      );
      const qaPassed = Boolean(qa);
      const overrideAllowed =
        (identity.role === "owner" || identity.role === "founder") &&
        overrideReason.length >= 12;
      if ((!validation.valid || !qaPassed) && !overrideAllowed) {
        fail(
          "Publishing is blocked until validation and QA pass. An owner override needs a reason of at least 12 characters.",
          "/dashboard/agent/versions",
        );
      }
      const now = new Date().toISOString();
      await mutateLocalAgentAdminState(identity.merchantId, (stored) => {
        const candidate = stored.versions.find((item) => item.id === versionId);
        if (!candidate) throw new Error("Prompt version was not found.");
        candidate.status = "published";
        candidate.published_at = now;
        candidate.published_by = identity.userId;
        stored.activeVersionId = versionId;
        stored.auditLogs.unshift(
          localAudit("prompt_version_published", "prompt_version", versionId, {
            override_reason: overrideReason || null,
            qa_passed: qaPassed,
          }),
        );
      });
      resultMessage = `Version ${version.version_number} is now active.`;
    } catch (error) {
      console.error(
        "[nbeh] publish_prompt_version_failed",
        error instanceof Error ? error.message : "unknown error",
      );
      fail(
        "The version could not be published. The current live agent was not changed.",
        "/dashboard/agent/versions",
      );
    }
    finish(resultMessage, "/dashboard/agent/versions");
  }
  try {
    const { supabase, config } = await activeConfig(identity.merchantId);
    const state = await getAgentAdminState(identity);
    const current = getCurrentPromptCandidate(state.versions);
    if (!current || current.id !== versionId)
      throw new Error("Only the current draft can be published.");
    const { data: version, error } = await supabase
      .from("prompt_versions")
      .select("*")
      .eq("id", versionId)
      .eq("merchant_id", identity.merchantId)
      .maybeSingle();
    if (error || !version) throw new Error("Prompt version was not found.");
    const validation = validateSystemPrompt(version.system_prompt);
    const { data: qa } = await supabase
      .from("qa_runs")
      .select("*")
      .eq("prompt_version_id", version.id)
      .eq("status", "passed")
      .eq("hard_failures", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const qaPassed = qa?.status === "passed" && Number(qa.hard_failures) === 0;
    const overrideAllowed =
      (identity.role === "owner" || identity.role === "founder") &&
      overrideReason.length >= 12;
    if ((!validation.valid || !qaPassed) && !overrideAllowed) {
      throw new Error(
        "Publishing is blocked until validation and QA pass. Owner override requires a reason of at least 12 characters.",
      );
    }
    const versionedSettings = readVersionedAgentSettings(version.test_result);
    const usedOverride = (!validation.valid || !qaPassed) && overrideAllowed;
    const { error: publishError } = await supabase.rpc(
      "publish_prompt_version_atomic",
      {
        target_merchant_id: identity.merchantId,
        target_config_id: config.id,
        target_version_id: version.id,
        actor_user_id: identity.userId,
        config_snapshot: {
          ...(versionedSettings?.config_snapshot ?? {}),
          audit_details: {
            override_reason: usedOverride ? overrideReason : null,
            validation_passed: validation.valid,
            qa_passed: qaPassed,
            versioned_agent_settings: Boolean(versionedSettings),
          },
        },
        guardrail_snapshot: versionedSettings?.guardrail_snapshot ?? null,
      },
    );
    if (publishError) throw publishError;
    finish(
      `Version ${version.version_number} is now active.`,
      "/dashboard/agent/versions",
    );
  } catch (error) {
    console.error(
      "[nbeh] publish_prompt_version_failed",
      error instanceof Error ? error.message : "unknown error",
    );
    fail(
      "The version could not be published. The current live agent was not changed.",
      "/dashboard/agent/versions",
    );
  }
}

export async function rollbackPromptVersionAction(formData: FormData) {
  const identity = await requireAdvancedAgentUser();
  const versionId = value(formData, "version_id");
  const reason = value(formData, "reason");
  if (reason.length < 8)
    fail(
      "Rollback reason must be at least 8 characters.",
      "/dashboard/agent/versions",
    );
  if (resolveDataBackend() === "local") {
    let resultMessage = "Version restored.";
    try {
      const state = await getAgentAdminState(identity);
      const target = state.versions.find((item) => item.id === versionId);
      if (!target) throw new Error("Rollback target was not found.");
      await mutateLocalAgentAdminState(identity.merchantId, (stored) => {
        const candidate = stored.versions.find((item) => item.id === versionId);
        if (!candidate) throw new Error("Rollback target was not found.");
        candidate.status = "rollback";
        candidate.published_at = new Date().toISOString();
        candidate.published_by = identity.userId;
        stored.activeVersionId = versionId;
        stored.auditLogs.unshift(
          localAudit(
            "prompt_version_rolled_back",
            "prompt_version",
            versionId,
            { reason },
          ),
        );
      });
      resultMessage = `Rolled back to version ${target.version_number}.`;
    } catch (error) {
      console.error(
        "[nbeh] rollback_prompt_version_failed",
        error instanceof Error ? error.message : "unknown error",
      );
      fail(
        "Rollback could not be completed. The current live agent was not changed.",
        "/dashboard/agent/versions",
      );
    }
    finish(resultMessage, "/dashboard/agent/versions");
  }
  let restoredVersion = 0;
  try {
    const { supabase, config } = await activeConfig(identity.merchantId);
    const { data: target, error } = await supabase.from("prompt_versions").select("*").eq("id", versionId).eq("merchant_id", identity.merchantId).maybeSingle();
    if (error || !target) throw error ?? new Error("Rollback target was not found.");
    const versionedSettings = readVersionedAgentSettings(target.test_result);
    const { error: rollbackError } = await supabase.rpc("rollback_prompt_version_atomic", {
      target_merchant_id: identity.merchantId,
      target_config_id: config.id,
      target_version_id: target.id,
      actor_user_id: identity.userId,
      config_snapshot: { ...(versionedSettings?.config_snapshot ?? {}), audit_details: { reason, versioned_agent_settings: Boolean(versionedSettings) } },
      guardrail_snapshot: versionedSettings?.guardrail_snapshot ?? null,
    });
    if (rollbackError) throw rollbackError;
    restoredVersion = target.version_number;
  } catch (error) {
    console.error("[nbeh] rollback_prompt_version_failed", error instanceof Error ? error.message : "unknown error");
    fail("Rollback could not be completed. The current live agent was not changed.", "/dashboard/agent/versions");
  }
  finish(`Rolled back to version ${restoredVersion}.`, "/dashboard/agent/versions");
}

export async function archivePromptVersionAction(formData: FormData) {
  const identity = await requireAdvancedAgentUser();
  const versionId = value(formData, "version_id");
  if (resolveDataBackend() === "local") {
    try {
      const state = await getAgentAdminState(identity);
      if (versionId === state.active.promptVersionId)
        fail(
          "The active prompt version cannot be archived.",
          "/dashboard/agent/versions",
        );
      await mutateLocalAgentAdminState(identity.merchantId, (stored) => {
        const version = stored.versions.find((item) => item.id === versionId);
        if (!version) throw new Error("Prompt version was not found.");
        version.status = "archived";
        stored.auditLogs.unshift(
          localAudit("prompt_version_archived", "prompt_version", versionId),
        );
      });
    } catch (error) {
      console.error(
        "[nbeh] archive_prompt_version_failed",
        error instanceof Error ? error.message : "unknown error",
      );
      fail(
        "The version could not be archived. No live configuration was changed.",
        "/dashboard/agent/versions",
      );
    }
    finish("Prompt version archived.", "/dashboard/agent/versions");
  }
  try {
    const { supabase, config } = await activeConfig(identity.merchantId);
    if (versionId === config.active_version_id) throw new Error("The active prompt version cannot be archived.");
    const { error } = await supabase.from("prompt_versions").update({ status: "archived" }).eq("id", versionId).eq("merchant_id", identity.merchantId);
    if (error) throw error;
    await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "prompt_version_archived", entityType: "prompt_version", entityId: versionId });
  } catch (error) {
    console.error("[nbeh] archive_prompt_version_failed", error instanceof Error ? error.message : "unknown error");
    fail("The version could not be archived. No live configuration was changed.", "/dashboard/agent/versions");
  }
  finish("Prompt version archived.", "/dashboard/agent/versions");
}
