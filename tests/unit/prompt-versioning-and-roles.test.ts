import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_SYSTEM_PROMPT } from "@/lib/agent/default-prompt";
import { validateSystemPrompt } from "@/lib/agent/prompt-validation";
import {
  canManageAdvancedAgent,
  canManageIntegrations,
} from "@/lib/auth/roles";
import {
  getCurrentPromptCandidate,
  nextPromptVersionNumber,
} from "@/lib/agent/prompt-versioning";
import {
  finiteNumber,
  linesToList,
  readVersionedAgentSettings,
} from "@/lib/agent/config-snapshot";

describe("prompt validation", () => {
  it("accepts the safe default prompt", () => {
    const result = validateSystemPrompt(DEFAULT_AGENT_SYSTEM_PROMPT);
    expect(result.valid).toBe(true);
    expect(result.hardFailures).toBe(0);
  });

  it("blocks unsafe prompts and warns when fallback guidance is absent", () => {
    const result = validateSystemPrompt(
      "Sell this item confidently and answer every question.",
    );
    expect(result.valid).toBe(false);
    expect(
      result.findings.some((finding) => finding.key === "missing_info"),
    ).toBe(true);
  });
});

describe("merchant roles", () => {
  it("allows owner and advanced admin to edit advanced settings", () => {
    expect(canManageAdvancedAgent("owner")).toBe(true);
    expect(canManageAdvancedAgent("advanced_admin")).toBe(true);
  });

  it("blocks viewers from advanced settings", () => {
    expect(canManageAdvancedAgent("viewer")).toBe(false);
  });

  it("keeps commerce integration ownership separate from prompt governance", () => {
    expect(canManageIntegrations("owner")).toBe(true);
    expect(canManageIntegrations("admin")).toBe(true);
    expect(canManageIntegrations("advanced_admin")).toBe(false);
    expect(canManageIntegrations("viewer")).toBe(false);
  });
});

describe("prompt versioning", () => {
  it("creates the next monotonic version number", () => {
    expect(
      nextPromptVersionNumber([{ version_number: 3 }, { version_number: 1 }]),
    ).toBe(4);
    expect(nextPromptVersionNumber([])).toBe(1);
  });

  it("always chooses the newest draft or tested version as the one current candidate", () => {
    const current = getCurrentPromptCandidate([
      { version_number: 9, status: "published" as const },
      { version_number: 7, status: "draft" as const },
      { version_number: 8, status: "tested" as const },
      { version_number: 6, status: "draft" as const },
    ]);
    expect(current?.version_number).toBe(8);
    expect(
      getCurrentPromptCandidate([
        { version_number: 4, status: "published" as const },
      ]),
    ).toBeNull();
  });

  it("normalizes versioned behavior and guardrail settings", () => {
    expect(linesToList("price\ncare, price\nfit")).toEqual([
      "price",
      "care",
      "fit",
    ]);
    expect(finiteNumber("2", 0, 1, 0.25)).toBe(1);
    const settings = readVersionedAgentSettings({
      config_snapshot: {
        tone_preset: "consultative",
        response_language_policy: "match_shopper",
        temperature: 0.35,
        max_tokens: 500,
        product_context_policy: { related_products: false },
        fallback_policy: { missing_information: "merchant" },
        safety_policy: { hard_code_guardrails: true },
        objection_policy: { honest_tradeoffs: true },
        advanced_settings: { answer_length: "40-100 words" },
      },
      guardrail_snapshot: {
        allowed_topics: ["product facts"],
        blocked_topics: ["credentials"],
        blocked_claims: ["invented discounts"],
        fallback_response_ar: "غير متوفر",
        fallback_response_en: "Not available",
        confidence_threshold: 0.6,
        on_violation: "refuse",
      },
    });
    expect(settings?.config_snapshot.tone_preset).toBe("consultative");
    expect(settings?.guardrail_snapshot.on_violation).toBe("refuse");
    expect(settings?.config_snapshot.advanced_settings).toEqual({
      answer_length: "40-100 words",
    });
  });

  it("does not invent a settings snapshot for legacy prompt versions", () => {
    expect(readVersionedAgentSettings({ passed: true })).toBeNull();
  });
});
