import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { normalizeQuestion } from "@/lib/insights/extractor";
import { redactSensitiveText } from "@/lib/privacy/redaction";
import { createServiceClient } from "@/utils/supabase/server";
import type {
  AgentAnswer,
  AgentConversationTurn,
  DemoProduct,
  FallbackReason,
  ObjectionCategory,
  StorefrontLocale,
} from "@/lib/types";

const RATE_LIMIT_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function stableUuid(value: string): string {
  const hex = createHash("sha256").update(`ai-sales-agent:${value}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const raw = hex.join("");
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function asUuid(kind: string, value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : stableUuid(`${kind}:${value}`);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export interface RuntimeHistoryRow {
  sender_type: string;
  content: unknown;
  fallback_reason?: unknown;
  metadata_json?: unknown;
  created_at?: unknown;
}

function historyRowRank(row: RuntimeHistoryRow): number {
  if (record(row.metadata_json).welcome === true) return 0;
  return row.sender_type === "visitor" ? 1 : 2;
}

export function orderRuntimeHistoryRows<T extends RuntimeHistoryRow>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
      const timeDifference = Date.parse(String(left.created_at ?? "")) - Date.parse(String(right.created_at ?? ""));
      if (Number.isFinite(timeDifference) && timeDifference !== 0) return timeDifference;
      return historyRowRank(left) - historyRowRank(right);
    });
}

export function normalizeRuntimeHistory(rows: RuntimeHistoryRow[]): AgentConversationTurn[] {
  return orderRuntimeHistoryRows(rows)
    .map((item) => ({
      role: item.sender_type === "visitor" ? "user" as const : "assistant" as const,
      content: String(item.content),
      ...(item.fallback_reason ? { fallbackReason: String(item.fallback_reason) } : {}),
    }));
}

export interface SupabaseAgentRuntimeState {
  conversationId: string;
  isNewConversation: boolean;
  history: AgentConversationTurn[];
  rateLimited: boolean;
  retryAfterSeconds?: number;
}

function rateLimitResult(value: unknown): { allowed: boolean; retryAfterSeconds: number } | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const result = row as Record<string, unknown>;
  if (typeof result.allowed !== "boolean") return null;
  return {
    allowed: result.allowed,
    retryAfterSeconds: Math.max(0, Number(result.retry_after_seconds ?? 0) || 0),
  };
}

export async function loadSupabaseAgentRuntimeState(input: {
  conversationId?: string;
  merchantId: string;
  productId: string;
  visitorRef: string;
  requestFingerprint?: string;
}): Promise<SupabaseAgentRuntimeState> {
  const supabase = createServiceClient();
  const conversationId = input.conversationId
    ? asUuid(`conversation:${input.merchantId}`, input.conversationId)
    : randomUUID();

  const fingerprintLimitPromise = input.requestFingerprint
    ? supabase.rpc("consume_request_rate_limit", {
      target_merchant_id: input.merchantId,
      target_scope: "shopper_chat",
      target_fingerprint_hash: input.requestFingerprint,
      target_limit: RATE_LIMIT_MESSAGES,
      target_window_seconds: Math.round(RATE_LIMIT_WINDOW_MS / 1000),
      request_time: new Date().toISOString(),
    })
    : Promise.resolve({ data: null, error: null });

  const [{ data: conversation, error: conversationError }, { data: visitor, error: visitorError }, fingerprintLimitResponse] = await Promise.all([
    supabase.from("conversations").select("id,product_id,metadata_json").eq("id", conversationId).eq("merchant_id", input.merchantId).maybeSingle(),
    supabase.from("visitors").select("id").eq("merchant_id", input.merchantId).eq("anonymous_ref", input.visitorRef).maybeSingle(),
    fingerprintLimitPromise,
  ]);
  if (conversationError) throw conversationError;
  if (visitorError) throw visitorError;
  if (fingerprintLimitResponse.error) throw fingerprintLimitResponse.error;
  const fingerprintLimit = rateLimitResult(fingerprintLimitResponse.data);
  if (input.requestFingerprint && !fingerprintLimit) throw new Error("Rate-limit service returned an invalid response.");

  if (conversation) {
    const metadata = record(conversation.metadata_json);
    if (String(conversation.product_id ?? "") !== input.productId || String(metadata.visitor_ref ?? "") !== input.visitorRef) {
      throw new Error("Conversation does not belong to this anonymous visitor, merchant, and product.");
    }
  }

  const historyPromise = conversation
    ? supabase.from("messages").select("sender_type,content,fallback_reason,metadata_json,created_at").eq("conversation_id", conversationId).eq("merchant_id", input.merchantId).in("sender_type", ["visitor", "assistant"]).order("created_at", { ascending: false }).limit(12)
    : Promise.resolve({ data: [], error: null });

  let rateLimited = fingerprintLimit ? !fingerprintLimit.allowed : false;
  if (visitor?.id) {
    const { data: recentConversations, error: recentConversationsError } = await supabase
      .from("conversations")
      .select("id")
      .eq("merchant_id", input.merchantId)
      .eq("visitor_id", visitor.id)
      .order("started_at", { ascending: false })
      .limit(200);
    if (recentConversationsError) throw recentConversationsError;
    const conversationIds = (recentConversations ?? []).map((item) => String(item.id));
    if (conversationIds.length) {
      const { count, error: countError } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", input.merchantId)
        .eq("sender_type", "visitor")
        .in("conversation_id", conversationIds)
        .gte("created_at", new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString());
      if (countError) throw countError;
      rateLimited = rateLimited || (count ?? 0) >= RATE_LIMIT_MESSAGES;
    }
  }

  const { data: historyRows, error: historyError } = await historyPromise;
  if (historyError) throw historyError;
  return {
    conversationId,
    isNewConversation: !conversation,
    history: normalizeRuntimeHistory(historyRows ?? []),
    rateLimited,
    retryAfterSeconds: rateLimited ? Math.max(1, fingerprintLimit?.retryAfterSeconds ?? 60) : undefined,
  };
}

interface InsightSignal {
  type: "repeated_question" | "objection" | "weak_description" | "unknown_answer";
  category: string;
  title: string;
  content: string;
  severity: "medium" | "high";
}

function insightSignals(input: {
  repeated: boolean;
  objection?: ObjectionCategory;
  weakDescriptionSignal?: string;
  fallbackReason?: FallbackReason;
}): InsightSignal[] {
  const signals: InsightSignal[] = [];
  if (input.repeated) signals.push({ type: "repeated_question", category: "repeated", title: "Repeated shopper question", content: "A shopper question is recurring for this product.", severity: "medium" });
  if (input.objection) signals.push({ type: "objection", category: input.objection, title: "Shopper objection detected", content: `Detected ${input.objection.replaceAll("_", " ")} from a shopper message.`, severity: "medium" });
  if (input.weakDescriptionSignal) signals.push({ type: "weak_description", category: input.weakDescriptionSignal, title: "Product content improvement signal", content: `Product copy may need more detail about ${input.weakDescriptionSignal.replaceAll("_", " ")}.`, severity: "medium" });
  if (input.fallbackReason) signals.push({ type: "unknown_answer", category: input.fallbackReason, title: "Fallback or unknown-answer event", content: `Agent used fallback reason: ${input.fallbackReason}.`, severity: "high" });
  return signals;
}

export async function persistSupabaseAgentTurn(input: {
  merchantId: string;
  product: DemoProduct;
  visitorRef: string;
  conversationId: string;
  isNewConversation: boolean;
  storefrontLocale?: StorefrontLocale;
  responseLanguage: "ar" | "en";
  welcomeMessage: string;
  userMessage: string;
  answer: AgentAnswer;
  objection?: ObjectionCategory;
  weakDescriptionSignal?: string;
}): Promise<{ insightsCreated: number }> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  // Repeated-question detection and all writes execute inside one database
  // transaction. A provider/network interruption can no longer leave an empty
  // conversation, half a message pair, or an insight without its evidence.
  const signals = insightSignals({
    repeated: false,
    objection: input.objection,
    weakDescriptionSignal: input.weakDescriptionSignal,
    fallbackReason: input.answer.fallbackReason,
  });
  const { data, error } = await supabase.rpc("persist_agent_turn_atomic", {
    target_merchant_id: input.merchantId,
    target_product_id: input.product.id,
    target_product_slug: input.product.slug,
    target_visitor_ref: input.visitorRef,
    target_conversation_id: input.conversationId,
    target_is_new: input.isNewConversation,
    target_storefront_locale: input.storefrontLocale ?? null,
    target_response_language: input.responseLanguage,
    target_welcome_message: redactSensitiveText(input.welcomeMessage),
    target_user_message: redactSensitiveText(input.userMessage),
    target_normalized_question: normalizeQuestion(input.userMessage),
    target_answer: {
      text: redactSensitiveText(input.answer.text),
      language: input.answer.language,
      model: input.answer.model ?? null,
      provider: input.answer.provider ?? null,
      token_usage: { prompt: input.answer.promptTokens ?? null, completion: input.answer.completionTokens ?? null, total: input.answer.totalTokens ?? null, estimated_cost_usd: input.answer.estimatedCost ?? null },
      latency_ms: input.answer.latencyMs ?? null,
      safety_flags: { error_code: input.answer.errorCode ?? null, confidence: input.answer.confidence },
      fallback_reason: input.answer.fallbackReason ?? null,
      detected_objection: input.objection ?? null,
      metadata: { prompt_version: input.answer.promptVersion ?? null, provider_route: input.answer.providerRoute ?? null },
    },
    target_signals: signals,
    request_time: now,
  });
  if (error) throw error;
  const result = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  return { insightsCreated: Math.max(0, Number(result.insights_created ?? 0) || 0) };
}
