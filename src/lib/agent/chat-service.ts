import { randomUUID } from "node:crypto";
import { appendAnalyticsEvent } from "@/lib/analytics/events";
import { getModelConfig } from "@/lib/ai/model-config";
import { isRateLimited } from "@/lib/agent/abuse-guard";
import { evaluateGuardrails } from "@/lib/agent/guardrails";
import { detectLanguage, fallbackText } from "@/lib/agent/language";
import { generateAgentAnswer } from "@/lib/agent/llm-client";
import { buildAgentWelcomeMessage } from "@/lib/agent/welcome";
import { detectObjection, extractInsightsForMessage } from "@/lib/insights/extractor";
import { getSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { redactSensitiveText } from "@/lib/privacy/redaction";
import { loadDatabase, mutateDatabase } from "@/lib/storage/json-store";
import { logProductAgentActionToSupabase, persistDemoSnapshotToSupabase } from "@/lib/storage/supabase-store";
import type { AgentAnswer, AgentConversationTurn, AgentPageContext, Conversation, Message, StorefrontLocale } from "@/lib/types";

export interface ChatInput {
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

function assertConversationBelongsToVisitor(conversationId: string | undefined, productSlug: string, visitorRef: string) {
  if (!conversationId) return;
  const existing = loadDatabase().conversations.find((item) => item.id === conversationId);
  if (!existing) return;
  if (existing.productSlug !== productSlug || existing.visitorRef !== visitorRef) {
    throw new Error("Conversation does not belong to this anonymous visitor and product.");
  }
}

export function getConversationTranscript(input: {
  conversationId: string;
  productSlug: string;
  visitorRef: string;
}): ChatTranscriptResult | null {
  const db = loadDatabase();
  const conversation = db.conversations.find((item) => item.id === input.conversationId);
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

export async function handleChat(input: ChatInput): Promise<ChatResult> {
  const agentMode = getModelConfig().mode;
  const knowledge = getSellerKnowledgeForProduct(input.productSlug);
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
  assertConversationBelongsToVisitor(input.conversationId, product.slug, visitorRef);
  const conversationHistory: AgentConversationTurn[] = input.conversationId
    ? loadDatabase().messages
        .filter((item) => item.conversationId === input.conversationId && (item.role === "assistant" || item.role === "user"))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-12)
        .map((item) => ({ role: item.role as "assistant" | "user", content: item.content }))
    : [];
  const safePageContext = sanitizePageContext(
    input.pageContext,
    product.name,
    product.slug,
    merchant?.name ?? "Store",
    storefrontLocale,
  );

  let answer: AgentAnswer | null = null;
  if (preliminaryGuardrail.allowed) {
    answer = await generateAgentAnswer(product, cleanMessage, safePageContext, knowledge ?? undefined, conversationHistory);
  }

  const storedResult = mutateDatabase((db): InternalChatResult => {
    const now = new Date().toISOString();
    const rateLimited = isRateLimited(db, visitorRef);
    let conversation = input.conversationId
      ? db.conversations.find((item) => item.id === input.conversationId)
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
      } satisfies Conversation;
      db.conversations.push(conversation);
      appendAnalyticsEvent(db, { type: "conversation_started", product, visitorRef, storefrontLocale });

      const welcomeMessage: Message = {
        id: randomUUID(),
        conversationId: conversation.id,
        role: "assistant",
        content: buildAgentWelcomeMessage(
          safeTranscriptProductName(input.pageContext, product.name),
          storefrontLocale ?? responseLanguage,
        ),
        createdAt: now,
      };
      db.messages.push(welcomeMessage);
    }

    const visitor = db.visitors.find((item) => item.anonymousRef === visitorRef);
    if (visitor) {
      visitor.lastSeenAt = now;
    } else {
      db.visitors.push({ id: randomUUID(), anonymousRef: visitorRef, firstSeenAt: now, lastSeenAt: now });
    }

    const userMessage: Message = {
      id: randomUUID(),
      conversationId: conversation.id,
      role: "user",
      content: redactedUserContent,
      createdAt: now,
    };
    db.messages.push(userMessage);
    appendAnalyticsEvent(db, { type: "message_sent", product, visitorRef, storefrontLocale });

    if (rateLimited) {
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

    const finalAnswer = answer ?? {
      text: fallbackText("model_error", responseLanguage),
      fallbackReason: "model_error",
      confidence: 0.1,
      mode: agentMode,
      language: responseLanguage,
    };

    const assistantMessage: Message = {
      id: randomUUID(),
      conversationId: conversation.id,
      role: "assistant",
      content: redactSensitiveText(finalAnswer.text),
      createdAt: new Date().toISOString(),
      fallbackReason: finalAnswer.fallbackReason,
    };
    db.messages.push(assistantMessage);
    appendAnalyticsEvent(db, { type: "agent_answered", product, visitorRef, storefrontLocale });

    const objection = finalAnswer.detectedObjection ?? detectObjection(cleanMessage);
    if (objection) {
      conversation.detectedObjection = objection;
      appendAnalyticsEvent(db, { type: "objection_detected", product, visitorRef, storefrontLocale });
    }

    if (finalAnswer.fallbackReason) {
      conversation.fallbackReason = finalAnswer.fallbackReason;
      appendAnalyticsEvent(db, { type: "fallback_triggered", product, visitorRef, storefrontLocale });
    }

    conversation.updatedAt = assistantMessage.createdAt;
    const insights = extractInsightsForMessage({
      db,
      product,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      userMessage: cleanMessage,
      fallbackReason: finalAnswer.fallbackReason,
    });

    if (insights.some((insight) => insight.type === "repeated_question")) {
      appendAnalyticsEvent(db, { type: "repeated_question_detected", product, visitorRef, storefrontLocale });
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

  await Promise.all([
    persistDemoSnapshotToSupabase(storedResult.conversationId),
    logProductAgentActionToSupabase({
      product,
      conversationId: storedResult.conversationId,
      visitorRef,
      message: cleanMessage,
      answer: storedResult.agentAnswer,
      fallbackReason: storedResult.fallbackReason,
      pageContext: safePageContext,
    }),
  ]);

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
