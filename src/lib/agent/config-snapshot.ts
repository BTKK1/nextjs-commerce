export interface VersionedAgentConfigSnapshot {
  tone_preset: string;
  response_language_policy: string;
  temperature: number;
  max_tokens: number;
  product_context_policy: Record<string, unknown>;
  fallback_policy: Record<string, unknown>;
  safety_policy: Record<string, unknown>;
  objection_policy: Record<string, unknown>;
  advanced_settings: Record<string, unknown>;
}

export interface VersionedGuardrailSnapshot {
  allowed_topics: string[];
  blocked_topics: string[];
  blocked_claims: string[];
  fallback_response_ar: string;
  fallback_response_en: string;
  confidence_threshold: number;
  on_violation: "refuse" | "fallback" | "escalate";
}

export interface VersionedAgentSettings {
  config_snapshot: VersionedAgentConfigSnapshot;
  guardrail_snapshot: VersionedGuardrailSnapshot;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function linesToList(value: string): string[] {
  return [...new Set(value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))];
}

export function readVersionedAgentSettings(testResult: unknown): VersionedAgentSettings | null {
  const result = record(testResult);
  const config = record(result.config_snapshot);
  const guardrail = record(result.guardrail_snapshot);
  if (!Object.keys(config).length || !Object.keys(guardrail).length) return null;

  const onViolation = guardrail.on_violation;
  return {
    config_snapshot: {
      tone_preset: typeof config.tone_preset === "string" ? config.tone_preset : "neutral_saudi",
      response_language_policy: typeof config.response_language_policy === "string" ? config.response_language_policy : "match_shopper",
      temperature: Number(config.temperature),
      max_tokens: Number(config.max_tokens),
      product_context_policy: record(config.product_context_policy),
      fallback_policy: record(config.fallback_policy),
      safety_policy: record(config.safety_policy),
      objection_policy: record(config.objection_policy),
      advanced_settings: record(config.advanced_settings),
    },
    guardrail_snapshot: {
      allowed_topics: stringArray(guardrail.allowed_topics),
      blocked_topics: stringArray(guardrail.blocked_topics),
      blocked_claims: stringArray(guardrail.blocked_claims),
      fallback_response_ar: typeof guardrail.fallback_response_ar === "string" ? guardrail.fallback_response_ar : "",
      fallback_response_en: typeof guardrail.fallback_response_en === "string" ? guardrail.fallback_response_en : "",
      confidence_threshold: Number(guardrail.confidence_threshold),
      on_violation: onViolation === "refuse" || onViolation === "escalate" ? onViolation : "fallback",
    },
  };
}

export function finiteNumber(value: string, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
