import { loadDatabase } from "@/lib/storage/json-store";
import type { Conversation, DemoDatabase, Insight, Message } from "@/lib/types";

export interface ConversationSummary {
  id: string;
  productName: string;
  productSlug: string;
  visitorRef: string;
  status: Conversation["status"];
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  fallbackReason?: string | null;
  detectedObjection?: string | null;
}

export function calculateUnknownAnswerRate(db: DemoDatabase): number {
  const assistantMessages = db.messages.filter((message) => message.role === "assistant");
  if (assistantMessages.length === 0) return 0;
  const fallbackMessages = assistantMessages.filter((message) => Boolean(message.fallbackReason));
  return Math.round((fallbackMessages.length / assistantMessages.length) * 100);
}

export function averageAnswerQuality(db: DemoDatabase): number | null {
  const ratings = db.messages
    .map((message) => message.qualityRating)
    .filter((rating): rating is number => typeof rating === "number");
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;
}

export function getConversationSummaries(db: DemoDatabase): ConversationSummary[] {
  return [...db.conversations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((conversation) => {
      const product = db.products.find((item) => item.slug === conversation.productSlug);
      return {
        id: conversation.id,
        productName: product?.name ?? conversation.productSlug,
        productSlug: conversation.productSlug,
        visitorRef: conversation.visitorRef,
        status: conversation.status,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: db.messages.filter((message) => message.conversationId === conversation.id).length,
        fallbackReason: conversation.fallbackReason,
        detectedObjection: conversation.detectedObjection
      };
    });
}

export function getConversationDetail(id: string, db = loadDatabase()) {
  const conversation = db.conversations.find((item) => item.id === id);
  if (!conversation) return null;
  const product = db.products.find((item) => item.slug === conversation.productSlug) ?? null;
  const messages = db.messages.filter((message) => message.conversationId === id);
  const insightIds = db.insightSources
    .filter((source) => source.conversationId === id)
    .map((source) => source.insightId);
  const insights = db.insights.filter((insight) => insightIds.includes(insight.id));
  return { conversation, product, messages, insights };
}

export function getDashboardOverview(db = loadDatabase()) {
  const widgetImpressions = db.events.filter((event) => event.type === "widget_impression").length;
  const productPageViews = db.events.filter((event) => event.type === "product_page_view").length;
  const conversationStarts = db.events.filter((event) => event.type === "conversation_started").length;
  const totalMessages = db.messages.length;
  const objectionsCount = db.insights
    .filter((insight) => insight.type === "objection")
    .reduce((sum, insight) => sum + insight.count, 0);
  const repeatedQuestionsCount = db.insights
    .filter((insight) => insight.type === "repeated_question")
    .reduce((sum, insight) => sum + insight.count, 0);
  const weakDescriptionSignals = db.insights
    .filter((insight) => insight.type === "weak_description")
    .reduce((sum, insight) => sum + insight.count, 0);
  const interactionRate = productPageViews
    ? Math.round((conversationStarts / productPageViews) * 100)
    : conversationStarts > 0
      ? 100
      : 0;

  return {
    merchant: db.merchants[0],
    kpis: {
      widgetImpressions,
      productPageViews,
      conversationStarts,
      interactionRate,
      totalMessages,
      unknownAnswerRate: calculateUnknownAnswerRate(db),
      objectionsCount,
      repeatedQuestionsCount,
      weakDescriptionSignals,
      answerQualityRating: averageAnswerQuality(db)
    },
    conversations: getConversationSummaries(db),
    products: db.products,
    insights: db.insights.sort((a, b) => b.count - a.count),
    integrations: db.platformIntegrations,
    syncJobs: db.syncJobs,
    guardrails: db.guardrails,
    settings: db.dashboardSettings[0]
  };
}

export function groupInsightsByProduct(insights: Insight[]) {
  return insights.reduce<Record<string, Insight[]>>((groups, insight) => {
    groups[insight.productSlug] ??= [];
    groups[insight.productSlug].push(insight);
    return groups;
  }, {});
}

export function transcriptPreview(messages: Message[]): string {
  return messages
    .slice(-2)
    .map((message) => `${message.role}: ${message.content}`)
    .join(" ");
}
