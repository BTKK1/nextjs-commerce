import "server-only";
import { createClient, createServiceClient, hasSupabaseServiceConfig } from "@/utils/supabase/server";
import { resolveDataBackend } from "@/lib/backend/mode";
import { DEFAULT_AGENT_SYSTEM_PROMPT, DEFAULT_MERCHANT_AGENT_GUIDANCE } from "@/lib/agent/default-prompt";
import { DEMO_AGENT_CONFIG_ID, DEFAULT_PROMPT_VERSION_ID } from "@/lib/supabase/constants";
import type { DashboardIdentity } from "@/lib/auth/require-user";
import type { AgentConfigRow, GuardrailRow, PromptVersionRow } from "@/lib/supabase/types";
import { readVersionedAgentSettings } from "@/lib/agent/config-snapshot";
import { readGlobalAgentConfig } from "@/lib/agent/global-config";
import { readLocalAgentAdminState } from "@/lib/agent/local-admin-store";

export interface RuntimeAgentConfig {
  configId: string;
  merchantId: string;
  promptVersionId: string | null;
  versionNumber: number;
  status: string;
  modelProvider: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  tonePreset: string;
  responseLanguagePolicy: string;
  systemPrompt: string;
  developerPrompt: string | null;
  productContextPolicy: Record<string, unknown>;
  fallbackPolicy: Record<string, unknown>;
  safetyPolicy: Record<string, unknown>;
  objectionPolicy: Record<string, unknown>;
  advancedSettings: Record<string, unknown>;
  guardrails: GuardrailRow[];
  source: "supabase" | "default";
}

export interface AgentAdminState {
  active: RuntimeAgentConfig;
  versions: PromptVersionRow[];
  qaRuns: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
  warning?: string | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function defaultConfig(merchantId: string): Promise<RuntimeAgentConfig> {
  const global = await readGlobalAgentConfig();
  return {
    configId: DEMO_AGENT_CONFIG_ID,
    merchantId,
    promptVersionId: DEFAULT_PROMPT_VERSION_ID,
    versionNumber: 1,
    status: "published",
    modelProvider: global.modelProvider,
    modelName: global.modelName,
    temperature: 0.25,
    maxTokens: 420,
    tonePreset: "neutral_saudi",
    responseLanguagePolicy: "match_shopper",
    systemPrompt: global.systemPrompt || DEFAULT_AGENT_SYSTEM_PROMPT,
    developerPrompt: global.developerPrompt,
    productContextPolicy: { current_product_only_by_default: true, related_products: true },
    fallbackPolicy: { missing_information: "merchant_or_product_page" },
    safetyPolicy: { hard_code_guardrails: true },
    objectionPolicy: { honest_tradeoffs: true, useful_next_question: "only_when_needed" },
    advancedSettings: {
      answer_length: "Usually 1-2 short conversational lines",
      arabic_tone: "natural white Saudi Arabic",
      english_tone: "direct concise human sales style",
    },
    guardrails: [],
    source: "default",
  };
}

function runtimeFromRows(config: AgentConfigRow, version: PromptVersionRow | null, guardrails: GuardrailRow[]): RuntimeAgentConfig {
  return {
    configId: config.id, merchantId: config.merchant_id, promptVersionId: version?.id ?? config.active_version_id,
    versionNumber: version?.version_number ?? 1, status: version?.status ?? config.status,
    modelProvider: config.model_provider, modelName: config.model_name, temperature: Number(config.temperature), maxTokens: config.max_tokens,
    tonePreset: config.tone_preset, responseLanguagePolicy: config.response_language_policy,
    systemPrompt: version?.system_prompt ?? config.system_prompt,
    developerPrompt: version?.developer_prompt ?? config.developer_prompt,
    productContextPolicy: record(config.product_context_policy), fallbackPolicy: record(config.fallback_policy),
    safetyPolicy: record(config.safety_policy), objectionPolicy: record(config.objection_policy), advancedSettings: record(config.advanced_settings),
    guardrails, source: "supabase",
  };
}

export async function getActiveAgentConfig(merchantId: string): Promise<RuntimeAgentConfig> {
  if (resolveDataBackend() === "local") return defaultConfig(merchantId);
  if (!hasSupabaseServiceConfig()) {
    throw new Error("Supabase agent configuration is selected but its server credentials are not configured.");
  }
  const supabase = createServiceClient();
  const { data: config, error } = await supabase.from("agent_configs").select("*").eq("merchant_id", merchantId).eq("status", "active").limit(1).maybeSingle();
  if (error) throw error;
  if (!config) throw new Error("No active Supabase agent configuration exists for this merchant.");
  const [versionResult, guardrailResult] = await Promise.all([
    config.active_version_id ? supabase.from("prompt_versions").select("*").eq("id", config.active_version_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("guardrails").select("*").eq("merchant_id", merchantId).eq("agent_config_id", config.id),
  ]);
  if (versionResult.error) throw versionResult.error;
  if (guardrailResult.error) throw guardrailResult.error;
  const runtime = runtimeFromRows(config as AgentConfigRow, versionResult.data as PromptVersionRow | null, (guardrailResult.data ?? []) as GuardrailRow[]);
  const global = await readGlobalAgentConfig();
  const normalizedMerchantPrompt = runtime.systemPrompt.trim();
  const inheritedBaseline = normalizedMerchantPrompt === global.systemPrompt.trim()
    || normalizedMerchantPrompt === DEFAULT_AGENT_SYSTEM_PROMPT.trim();
  const merchantGuidance = inheritedBaseline ? DEFAULT_MERCHANT_AGENT_GUIDANCE : normalizedMerchantPrompt;
  const developerGuidance = [global.developerPrompt, runtime.developerPrompt]
    .map((value) => value?.trim())
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
    .join("\n\n");
  return {
    ...runtime,
    modelProvider: global.modelProvider,
    modelName: global.modelName,
    systemPrompt: `${global.systemPrompt}\n\nStore-specific guidance:\n${merchantGuidance}`,
    developerPrompt: developerGuidance || null,
  };
}

export async function getAgentAdminState(identity: DashboardIdentity): Promise<AgentAdminState> {
  if (resolveDataBackend() === "local") {
    const base = await defaultConfig(identity.merchantId);
    try {
      const stored = await readLocalAgentAdminState(identity.merchantId);
      const activeVersion = stored.activeVersionId ? stored.versions.find((version) => version.id === stored.activeVersionId) : null;
      return {
        active: activeVersion ? runtimeConfigForPromptVersion(base, activeVersion) : base,
        versions: stored.versions,
        qaRuns: stored.qaRuns,
        auditLogs: stored.auditLogs,
        warning: null,
      };
    } catch (error) {
      console.error("[nbeh] local_agent_admin_read_failed", error instanceof Error ? error.message : "unknown error");
      return {
        active: base,
        versions: [],
        qaRuns: [],
        auditLogs: [],
        warning: "Draft history is temporarily unavailable. The live agent is still running with its safe published configuration.",
      };
    }
  }
  if (!hasSupabaseServiceConfig()) {
    throw new Error("Supabase agent administration is selected but its server credentials are not configured.");
  }
  const client = identity.authMode === "founder" ? createServiceClient() : await createClient();
  const { data: config, error: configError } = await client.from("agent_configs").select("*").eq("merchant_id", identity.merchantId).eq("status", "active").limit(1).maybeSingle();
  if (configError) throw configError;
  if (!config) throw new Error("No active Supabase agent configuration exists for this merchant.");
  const [versions, guardrails, qaRuns, auditLogs] = await Promise.all([
    client.from("prompt_versions").select("*").eq("agent_config_id", config.id).order("version_number", { ascending: false }),
    client.from("guardrails").select("*").eq("agent_config_id", config.id),
    client.from("qa_runs").select("*").eq("agent_config_id", config.id).order("created_at", { ascending: false }).limit(20),
    client.from("audit_logs").select("*").eq("merchant_id", identity.merchantId).order("created_at", { ascending: false }).limit(50),
  ]);
  for (const result of [versions, guardrails, qaRuns, auditLogs]) {
    if (result.error) throw result.error;
  }
  const activeVersion = (versions.data ?? []).find((version) => version.id === config.active_version_id) ?? null;
  return {
    active: runtimeFromRows(config as AgentConfigRow, activeVersion as PromptVersionRow | null, (guardrails.data ?? []) as GuardrailRow[]),
    versions: (versions.data ?? []) as PromptVersionRow[],
    qaRuns: (qaRuns.data ?? []) as Array<Record<string, unknown>>,
    auditLogs: (auditLogs.data ?? []) as Array<Record<string, unknown>>,
  };
}

export function runtimeConfigForPromptVersion(active: RuntimeAgentConfig, version: PromptVersionRow): RuntimeAgentConfig {
  const settings = readVersionedAgentSettings(version.test_result);
  const guardrails = settings ? active.guardrails.map((guardrail, index) => index === 0 ? { ...guardrail, ...settings.guardrail_snapshot } : guardrail) : active.guardrails;
  return {
    ...active,
    promptVersionId: version.id,
    versionNumber: version.version_number,
    status: version.status,
    systemPrompt: version.system_prompt,
    developerPrompt: version.developer_prompt,
    ...(settings ? {
      tonePreset: settings.config_snapshot.tone_preset,
      responseLanguagePolicy: settings.config_snapshot.response_language_policy,
      temperature: settings.config_snapshot.temperature,
      maxTokens: settings.config_snapshot.max_tokens,
      productContextPolicy: settings.config_snapshot.product_context_policy,
      fallbackPolicy: settings.config_snapshot.fallback_policy,
      safetyPolicy: settings.config_snapshot.safety_policy,
      objectionPolicy: settings.config_snapshot.objection_policy,
      advancedSettings: settings.config_snapshot.advanced_settings,
      guardrails,
    } : {}),
  };
}
