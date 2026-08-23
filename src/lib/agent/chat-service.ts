import { randomUUID } from "node:crypto";
import { appendAnalyticsEvent } from "@/lib/analytics/events";
import { getModelConfig } from "@/lib/ai/model-config";
import { resolveDataBackend } from "@/lib/backend/mode";
import { isRateLimited } from "@/lib/agent/abuse-guard";
import { evaluateGuardrails } from "@/lib/agent/guardrails";
import { detectLanguage, fallbackText } from "@/lib/agent/language";
import { estimateAgentTokenReservation, generateAgentAnswer } from "@/lib/agent/llm-client";
import { buildAgentWelcomeMessage } from "@/lib/agent/welcome";
import { getActiveAgentConfig, type RuntimeAgentConfig } from "@/lib/agent/config-repository";
import { loadSupabaseAgentRuntimeState, normalizeRuntimeHistory, orderRuntimeHistoryRows, persistSupabaseAgentTurn } from "@/lib/agent/supabase-runtime";
import { reserveAgentTokenBudget, settleAgentTokenBudget } from "@/lib/agent/token-budget";
import { detectObjection, detectWeakDescriptionSignal, extractInsightsForMessage } from "@/lib/insights/extractor";
import { loadSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { redactSensitiveText } from "@/lib/privacy/redaction";
import { loadDatabase, mutateDatabase } from "@/lib/storage/json-store";
import { logProductAgentActionToSupabase } from "@/lib/storage/supabase-store";
import type { AgentAnswer, AgentConversationTurn, AgentPageContext, Conversation, Message, StorefrontLocale } from "@/lib/types";
import { createServiceClient, hasSupabaseServiceConfig } from "@/utils/supabase/server";

export interface ChatInput {
  merchantKey?: string;
  productSlug: string;
  message: string;
  conversationId?: string;
  sessionId?: string;
  visitorRef?: string;
  conversationHistory?: Array<{
    role: "assistant" | "user";
    content: string;
    fallbackReason?: string;
    createdAt?: string;
  }>;
  memory?: Record<string, unknown>;
  locale?: StorefrontLocale;
  pageContext?: AgentPageContext;
  /** Server-derived opaque HMAC; never supplied or controlled by the shopper. */
  requestFingerprint?: string;
}

export interface ChatResult {
  conversationId: string;
  productId?: string;
  productSlug?: string;
  answer: string;
  fallbackReason?: string;
  detectedObjection?: string;
  mode: string;
  insightsCreated: number;
  provider?: string | null;
  model?: string | null;
  providerRoute?: string;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCost?: number | null;
  retryAfterSeconds?: number;
}

export interface ChatTranscriptResult {
  conversationId: string;
  productId: string;
  productSlug: string;
  visitorRef: string;
  messages: Array<{
    role: "assistant" | "user";
    content: string;
    fallbackReason?: string | null;
    createdAt: string;
  }>;
  updatedAt: string;
}

type InternalChatResult = ChatResult & {
  agentAnswer: AgentAnswer;
};

const contextInjectionPattern =
  /(ignore|system prompt|system instructions|hidden prompt|api key|service role|admin credentials|password|تعليمات النظام|برومبت|مفتاح api|كلمة المرور|بيانات الأدمن|بيانات المدير)/i;

function cleanContextText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (!cleaned || contextInjectionPattern.test(cleaned)) return undefined;
  return cleaned;
}

function cleanPath(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const withoutQuery = value.split("?")[0].split("#")[0].trim().slice(0, 240);
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(withoutQuery) || contextInjectionPattern.test(withoutQuery)) return fallback;
  return withoutQuery;
}

function cleanUrlPath(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const parsed = new URL(value, "http://localhost");
    return cleanPath(parsed.pathname, fallback);
  } catch {
    return cleanPath(value, fallback);
  }
}

function sanitizePageContext(
  input: AgentPageContext | undefined,
  productName: string,
  productSlug: string,
  merchantName: string,
  locale?: StorefrontLocale,
): AgentPageContext {
  const cleanedTitle = cleanContextText(input?.title, 180);
  const safePath = cleanPath(input?.path, `/product/${productSlug}`);
  return {
    url: cleanUrlPath(input?.url, safePath),
    path: safePath,
    title: cleanedTitle?.toLowerCase().includes(productName.toLowerCase())
      ? cleanedTitle
      : `${productName} | ${merchantName}`,
    productName,
    locale,
  };
}

function safeTranscriptProductName(input: AgentPageContext | undefined, fallback: string): string {
  const cleaned = cleanContextText(input?.productName, 160);
  return cleaned || fallback;
}

async function assertConversationBelongsToVisitor(conversationId: string | undefined, merchantId: string, productId: string, productSlug: string, visitorRef: string) {
  if (!conversationId) return;
  if (resolveDataBackend() === "supabase") {
    const { data: existing } = await createServiceClient().from("conversations").select("product_id,metadata_json").eq("id", conversationId).eq("merchant_id", merchantId).maybeSingle();
    if (!existing) return;
    const metadata = existing.metadata_json && typeof existing.metadata_json === "object" ? existing.metadata_json as Record<string, unknown> : {};
    if (String(existing.product_id) !== productId || String(metadata.visitor_ref ?? "") !== visitorRef) {
      throw new Error("Conversation does not belong to this anonymous visitor, merchant, and product.");
    }
    return;
  }
  const existing = loadDatabase().conversations.find((item) => item.id === conversationId && item.merchantId === merchantId);
  if (!existing) return;
  if (existing.productSlug !== productSlug || existing.visitorRef !== visitorRef) {
    throw new Error("Conversation does not belong to this anonymous visitor, merchant, and product.");
  }
}

export async function getConversationTranscript(input: {
  conversationId: string;
  productSlug: string;
  visitorRef: string;
  merchantKey?: string;
}): Promise<ChatTranscriptResult | null> {
  const knowledge = await loadSellerKnowledgeForProduct(input.productSlug, input.merchantKey);
  if (!knowledge) return null;
  if (resolveDataBackend() === "supabase") {
    const supabase = createServiceClient();
    const { data: conversation } = await supabase.from("conversations").select("*").eq("id", input.conversationId).eq("merchant_id", knowledge.merchant.id).eq("product_id", knowledge.currentProduct.id).maybeSingle();
    if (!conversation) return null;
    const metadata = conversation.metadata_json && typeof conversation.metadata_json === "object" ? conversation.metadata_json as Record<string, unknown> : {};
    if (String(metadata.visitor_ref ?? "") !== input.visitorRef) throw new Error("Conversation does not belong to this anonymous visitor, merchant, and product.");
    const { data: messages } = await supabase.from("messages").select("sender_type,content,fallback_reason,metadata_json,created_at").eq("conversation_id", conversation.id).eq("merchant_id", knowledge.merchant.id).in("sender_type", ["visitor", "assistant"]).order("created_at", { ascending: true });
    return {
      conversationId: String(conversation.id), productId: String(conversation.product_id), productSlug: input.productSlug, visitorRef: input.visitorRef,
      messages: orderRuntimeHistoryRows(messages ?? []).map((message) => ({ role: message.sender_type === "visitor" ? "user" : "assistant", content: String(message.content), fallbackReason: message.fallback_reason ? String(message.fallback_reason) : null, createdAt: String(message.created_at) })),
      updatedAt: String(conversation.ended_at ?? conversation.started_at),
    };
  }
  const db = loadDatabase();
  const conversation = db.conversations.find((item) => item.id === input.conversationId && item.merchantId === knowledge.merchant.id);
  if (!conversation) return null;
  if (conversation.productSlug !== input.productSlug || conversation.visitorRef !== input.visitorRef) {
    throw new Error("Conversation does not belong to this anonymous visitor and product.");
  }

  return {
    conversationId: conversation.id,
    productId: conversation.productId,
    productSlug: conversation.productSlug,
    visitorRef: conversation.visitorRef,
    messages: db.messages
      .filter((message) => message.conversationId === conversation.id && (message.role === "assistant" || message.role === "user"))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((message) => ({
        role: message.role as "assistant" | "user",
        content: message.content,
        fallbackReason: message.fallbackReason,
        createdAt: message.createdAt,
      })),
    updatedAt: conversation.updatedAt,
  };
}

async function loadConversationHistory(conversationId: string | undefined, merchantId: string): Promise<AgentConversationTurn[]> {
  if (!conversationId) return [];
  if (resolveDataBackend() === "supabase") {
    const { data } = await createServiceClient().from("messages").select("sender_type,content,fallback_reason,metadata_json,created_at").eq("conversation_id", conversationId).eq("merchant_id", merchantId).in("sender_type", ["visitor", "assistant"]).order("created_at", { ascending: false }).limit(12);
    return normalizeRuntimeHistory(data ?? []);
  }
  return loadDatabase().messages
    .filter((item) => item.conversationId === conversationId && (item.role === "assistant" || item.role === "user"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-12)
    .map((item) => ({ role: item.role as "assistant" | "user", content: item.content, fallbackReason: item.fallbackReason }));
}

const CONFIGURABLE_FALLBACK_REASONS = new Set([
  "low_confidence",
  "missing_catalog_field",
  "model_error",
]);

function configuredFallbackText(
  config: RuntimeAgentConfig,
  reason: string,
  language: "ar" | "en",
): string {
  if (!CONFIGURABLE_FALLBACK_REASONS.has(reason)) {
    return fallbackText(reason, language);
  }
  const guardrail = config.guardrails[0];
  const configured = language === "ar"
    ? guardrail?.fallback_response_ar
    : guardrail?.fallback_response_en;
  return typeof configured === "string" && configured.trim()
    ? configured.trim().slice(0, 600)
    : fallbackText(reason, language);
}

export function applyFallbackExperience(
  answer: AgentAnswer,
  config: RuntimeAgentConfig,
  history: AgentConversationTurn[],
  language: "ar" | "en",
  relatedProductName?: string,
): AgentAnswer {
  if (!answer.fallbackReason) return answer;
  const base = configuredFallbackText(config, answer.fallbackReason, language);
  const previousTurnWasFallback = [...history]
    .reverse()
    .find((turn) => turn.role === "assistant")
    ?.fallbackReason;
  if (!previousTurnWasFallback || !CONFIGURABLE_FALLBACK_REASONS.has(answer.fallbackReason)) {
    return { ...answer, text: base };
  }

  const escalation = language === "ar"
    ? relatedProductName
      ? `أقدر بدلها أقارن لك مع ${relatedProductName}، أو الأفضل تتواصل مع المتجر للتأكد من هالنقطة.`
      : "خلنا ما نكرر نفس الرد: الأفضل تتواصل مع المتجر للتأكد من هالنقطة."
    : relatedProductName
      ? `I can compare it with ${relatedProductName} instead, or you can contact the store to confirm this detail.`
      : "Rather than repeat the same answer, please contact the store to confirm this detail.";
  return { ...answer, text: `${base} ${escalation}`.trim().slice(0, 900) };
}

export async function handleChat(input: ChatInput): Promise<ChatResult> {
  const agentMode = getModelConfig().mode;
  const dataBackend = resolveDataBackend();
  if (dataBackend === "supabase" && !hasSupabaseServiceConfig()) {
    throw new Error("Supabase agent persistence is selected but its server credentials are not configured.");
  }
  if (dataBackend === "supabase" && process.env.SUPABASE_AGENT_ENABLED !== "true") {
    throw new Error("Supabase agent persistence is selected but SUPABASE_AGENT_ENABLED is not true.");
  }
  const knowledge = await loadSellerKnowledgeForProduct(input.productSlug, input.merchantKey);
  const product = knowledge?.currentProduct ?? null;
  const merchant = knowledge?.merchant ?? null;
  const cleanMessage = input.message.trim().slice(0, 1500);
  const responseLanguage = cleanMessage ? detectLanguage(cleanMessage) : input.locale ?? input.pageContext?.locale ?? "en";
  const storefrontLocale = input.locale ?? input.pageContext?.locale;

  if (!product) {
    return {
      conversationId: input.conversationId ?? randomUUID(),
      answer:
        responseLanguage === "ar"
          ? "ما قدرت ألقى هذا المنتج في كتالوج المتجر."
          : "I could not find that product in the current store catalog.",
      fallbackReason: "missing_catalog_field",
      mode: agentMode,
      insightsCreated: 0,
    };
  }

  if (!cleanMessage) {
    return {
      conversationId: input.conversationId ?? randomUUID(),
      productId: product.id,
      productSlug: product.slug,
      answer: fallbackText("low_confidence", responseLanguage),
      fallbackReason: "low_confidence",
      mode: agentMode,
      insightsCreated: 0,
    };
  }

  const preliminaryGuardrail = evaluateGuardrails(cleanMessage, product);
  const redactedUserContent = redactSensitiveText(cleanMessage);
  const visitorRef = input.visitorRef || `anon-${randomUUID().slice(0, 8)}`;
  const useSupabaseRuntime = dataBackend === "supabase";
  const supabaseState = useSupabaseRuntime
    ? await loadSupabaseAgentRuntimeState({ conversationId: input.conversationId, merchantId: merchant?.id ?? "", productId: product.id, visitorRef, requestFingerprint: input.requestFingerprint })
    : null;
  if (!useSupabaseRuntime) {
    await assertConversationBelongsToVisitor(input.conversationId, merchant?.id ?? "", product.id, product.slug, visitorRef);
  }
  const conversationHistory = supabaseState?.history ?? await loadConversationHistory(input.conversationId, merchant?.id ?? "");
  const safePageContext = sanitizePageContext(
    input.pageContext,
    product.name,
    product.slug,
    merchant?.name ?? "Store",
    storefrontLocale,
  );
  const runtimeConfig = await getActiveAgentConfig(merchant?.id ?? "");
  const rateLimitedBeforeModel = supabaseState?.rateLimited ?? isRateLimited(loadDatabase(), visitorRef);

  let answer: AgentAnswer | null = null;
  if (preliminaryGuardrail.allowed && !rateLimitedBeforeModel) {
    let reservationId: string | null = null;
    if (useSupabaseRuntime) {
      // Reserve for the actual system prompt, trusted history, configured
      // output limit, and the single allowed repair pass. Settlement charges
      // only provider-reported usage and releases the remainder.
      const reservation = await reserveAgentTokenBudget(
        merchant?.id ?? "",
        estimateAgentTokenReservation(product, cleanMessage, safePageContext, knowledge ?? undefined, conversationHistory, runtimeConfig),
      );
      if (!reservation.allowed) {
        answer = {
          text: fallbackText("quota_exhausted", responseLanguage),
          fallbackReason: "quota_exhausted",
          confidence: 0.1,
          mode: agentMode,
          language: responseLanguage,
        };
      } else {
        reservationId = reservation.reservationId;
      }
    }
    if (!answer) {
      try {
        answer = await generateAgentAnswer(product, cleanMessage, safePageContext, knowledge ?? undefined, conversationHistory, runtimeConfig);
      } finally {
        if (reservationId) {
          try {
            await settleAgentTokenBudget(
              reservationId,
              answer?.totalTokens,
              Boolean(answer && answer.fallbackReason !== "model_error"),
            );
          } catch {
            // A stale reservation expires automatically after five minutes;
            // never replace a valid shopper answer with a metering error.
            console.error("Nbeh token budget settlement failed; reservation will expire automatically.");
          }
        }
      }
    }
  }

  if (rateLimitedBeforeModel) {
    answer = {
      text: fallbackText("rate_limited", responseLanguage),
      fallbackReason: "rate_limited",
      confidence: 0.1,
      mode: agentMode,
      language: responseLanguage,
    };
  } else if (!preliminaryGuardrail.allowed) {
    answer = {
      text: preliminaryGuardrail.message,
      fallbackReason: preliminaryGuardrail.reason,
      confidence: 0.25,
      mode: agentMode,
      language: responseLanguage,
    };
  }

  const generatedAnswer = answer ?? {
    text: fallbackText("model_error", responseLanguage),
    fallbackReason: "model_error" as const,
    confidence: 0.1,
    mode: agentMode,
    language: responseLanguage,
  };
  const weakDescriptionSignal = detectWeakDescriptionSignal(product, cleanMessage);
  // A useful, naturally worded answer can still be an honest "unknown". Keep
  // the live model text and telemetry, but tag questions that match a known
  // catalog gap so merchants see the missing product information in Insights.
  const finalAnswer: AgentAnswer = weakDescriptionSignal && !generatedAnswer.fallbackReason
    ? { ...generatedAnswer, fallbackReason: "missing_catalog_field" }
    : applyFallbackExperience(
      generatedAnswer,
      runtimeConfig,
      conversationHistory,
      responseLanguage,
      knowledge?.relatedProducts[0]?.name,
    );
  const detectedObjection = finalAnswer.detectedObjection ?? detectObjection(cleanMessage);

  // The atomic request bucket has already recorded the attempt. Do not create
  // conversations, messages, insights, or analytics for rejected traffic.
  if (useSupabaseRuntime && supabaseState?.rateLimited) {
    return {
      conversationId: supabaseState.conversationId,
      productId: product.id,
      productSlug: product.slug,
      answer: finalAnswer.text,
      fallbackReason: "rate_limited",
      mode: finalAnswer.mode,
      insightsCreated: 0,
      retryAfterSeconds: supabaseState.retryAfterSeconds,
    };
  }

  if (useSupabaseRuntime && supabaseState) {
    const persisted = await persistSupabaseAgentTurn({
      merchantId: merchant?.id ?? "",
      product,
      visitorRef,
      conversationId: supabaseState.conversationId,
      isNewConversation: supabaseState.isNewConversation,
      storefrontLocale,
      responseLanguage,
      welcomeMessage: buildAgentWelcomeMessage(safeTranscriptProductName(input.pageContext, product.name), storefrontLocale ?? responseLanguage, merchant?.name),
      userMessage: cleanMessage,
      answer: finalAnswer,
      objection: detectedObjection,
      weakDescriptionSignal,
    });
    try {
      await logProductAgentActionToSupabase({
        merchantId: merchant?.id ?? "", merchantName: merchant?.name ?? "Merchant", merchantPublicKey: merchant?.publicKey, provider: knowledge?.provider ?? "demo_catalog",
        product, conversationId: supabaseState.conversationId, visitorRef, message: cleanMessage, answer: finalAnswer,
        fallbackReason: finalAnswer.fallbackReason, pageContext: safePageContext,
      });
    } catch {
      console.error("Nbeh agent audit logging failed after the durable conversation turn was stored.");
    }
    return {
      conversationId: supabaseState.conversationId,
      productId: product.id,
      productSlug: product.slug,
      answer: finalAnswer.text,
      fallbackReason: finalAnswer.fallbackReason,
      detectedObjection,
      mode: finalAnswer.mode,
      insightsCreated: persisted.insightsCreated,
      provider: finalAnswer.provider,
      model: finalAnswer.model,
      providerRoute: finalAnswer.providerRoute,
      latencyMs: finalAnswer.latencyMs,
      promptTokens: finalAnswer.promptTokens,
      completionTokens: finalAnswer.completionTokens,
      totalTokens: finalAnswer.totalTokens,
      estimatedCost: finalAnswer.estimatedCost,
      retryAfterSeconds: supabaseState.retryAfterSeconds,
    };
  }

  const storedResult = mutateDatabase((db): InternalChatResult => {
    const now = new Date().toISOString();
    let conversation = input.conversationId
      ? db.conversations.find((item) => item.id === input.conversationId && item.merchantId === merchant?.id)
      : undefined;

    if (conversation && (conversation.productSlug !== product.slug || conversation.visitorRef !== visitorRef)) {
      throw new Error("Conversation does not belong to this anonymous visitor and product.");
    }

    if (!conversation) {
      conversation = {
        id: randomUUID(),
        merchantId: merchant?.id ?? db.merchants[0].id,
        productId: product.id,
        productSlug: product.slug,
        visitorRef,
        status: "open",
        createdAt: now,
        updatedAt: now,
        fallbackReason: null,
        detectedObjection: null,
        language: responseLanguage,
        metadata: { storefront_locale: storefrontLocale ?? null },
      } satisfies Conversation;
      db.conversations.push(conversation);
      appendAnalyticsEvent(db, { type: "conversation_started", product, visitorRef, storefrontLocale, merchantId: merchant?.id });

      const welcomeMessage: Message = {
        id: randomUUID(),
        conversationId: conversation.id,
        role: "assistant",
        content: buildAgentWelcomeMessage(
          safeTranscriptProductName(input.pageContext, product.name),
          storefrontLocale ?? responseLanguage,
          merchant?.name,
        ),
        createdAt: now,
      };
      db.messages.push(welcomeMessage);
    }

    const visitor = db.visitors.find((item) => item.anonymousRef === visitorRef && (!item.merchantId || item.merchantId === merchant?.id));
    if (visitor) {
      visitor.lastSeenAt = now;
    } else {
      db.visitors.push({ id: randomUUID(), merchantId: merchant?.id, anonymousRef: visitorRef, firstSeenAt: now, lastSeenAt: now });
    }

    const userMessage: Message = {
      id: randomUUID(),
      conversationId: conversation.id,
      role: "user",
      content: redactedUserContent,
      createdAt: now,
    };
    db.messages.push(userMessage);
    appendAnalyticsEvent(db, { type: "message_sent", product, visitorRef, storefrontLocale, merchantId: merchant?.id });

    const assistantMessage: Message = {
      id: randomUUID(),
      conversationId: conversation.id,
      role: "assistant",
      content: redactSensitiveText(finalAnswer.text),
      createdAt: new Date().toISOString(),
      fallbackReason: finalAnswer.fallbackReason,
      language: finalAnswer.language,
      model: finalAnswer.model,
      provider: finalAnswer.provider,
      tokenUsage: { prompt: finalAnswer.promptTokens ?? null, completion: finalAnswer.completionTokens ?? null, total: finalAnswer.totalTokens ?? null, estimated_cost_usd: finalAnswer.estimatedCost ?? null },
      latencyMs: finalAnswer.latencyMs,
      safetyFlags: { error_code: finalAnswer.errorCode ?? null, confidence: finalAnswer.confidence },
      metadata: { prompt_version: finalAnswer.promptVersion ?? null, provider_route: finalAnswer.providerRoute ?? null },
    };
    db.messages.push(assistantMessage);
    appendAnalyticsEvent(db, { type: "agent_answered", product, visitorRef, storefrontLocale, merchantId: merchant?.id });

    const objection = detectedObjection;
    if (objection) {
      conversation.detectedObjection = objection;
      appendAnalyticsEvent(db, { type: "objection_detected", product, visitorRef, storefrontLocale, merchantId: merchant?.id });
    }

    if (finalAnswer.fallbackReason) {
      conversation.fallbackReason = finalAnswer.fallbackReason;
      appendAnalyticsEvent(db, { type: "fallback_triggered", product, visitorRef, storefrontLocale, merchantId: merchant?.id });
    }

    conversation.updatedAt = assistantMessage.createdAt;
    const insights = extractInsightsForMessage({
      db,
      merchantId: merchant?.id,
      product,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      userMessage: cleanMessage,
      fallbackReason: finalAnswer.fallbackReason,
    });

    if (insights.some((insight) => insight.type === "repeated_question")) {
      appendAnalyticsEvent(db, { type: "repeated_question_detected", product, visitorRef, storefrontLocale, merchantId: merchant?.id });
    }

    return {
      conversationId: conversation.id,
      productId: product.id,
      productSlug: product.slug,
      answer: finalAnswer.text,
      fallbackReason: finalAnswer.fallbackReason,
      detectedObjection: objection,
      mode: finalAnswer.mode,
      insightsCreated: insights.length,
      provider: finalAnswer.provider,
      model: finalAnswer.model,
      providerRoute: finalAnswer.providerRoute,
      latencyMs: finalAnswer.latencyMs,
      promptTokens: finalAnswer.promptTokens,
      completionTokens: finalAnswer.completionTokens,
      totalTokens: finalAnswer.totalTokens,
      estimatedCost: finalAnswer.estimatedCost,
      agentAnswer: finalAnswer,
    };
  });

  return {
    conversationId: storedResult.conversationId,
    productId: storedResult.productId,
    productSlug: storedResult.productSlug,
    answer: storedResult.answer,
    fallbackReason: storedResult.fallbackReason,
    detectedObjection: storedResult.detectedObjection,
    mode: storedResult.mode,
    insightsCreated: storedResult.insightsCreated,
    provider: storedResult.provider,
    model: storedResult.model,
    providerRoute: storedResult.providerRoute,
    latencyMs: storedResult.latencyMs,
    promptTokens: storedResult.promptTokens,
    completionTokens: storedResult.completionTokens,
    totalTokens: storedResult.totalTokens,
    estimatedCost: storedResult.estimatedCost,
  };
}
