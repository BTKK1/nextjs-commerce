import { loadDatabase } from "@/lib/storage/json-store";
import type { Conversation, DemoDatabase, Insight, Message } from "@/lib/types";
import { estimateModelCostUsd } from "@/lib/ai/model-pricing";

export const DEFAULT_MONTHLY_TOKEN_ALLOWANCE = 1_000_000;

export interface DailyTokenUsage {
  date: string;
  tokens: number;
}

export interface TokenWalletSummary {
  monthlyAllowance: number;
  consumedThisCycle: number;
  remainingThisCycle: number;
  usagePercent: number;
  lifetimeConsumed: number;
  last7DaysConsumed: number;
  dailyBurnRate: number;
  projectedDaysRemaining: number | null;
  estimatedCostUsdThisCycle: number;
  lifetimeEstimatedCostUsd: number;
  costCoveragePercent: number;
  cycleStart: string;
  cycleEnd: string;
  dailyUsage: DailyTokenUsage[];
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function messageTokenUsage(message: Message) {
  const usage = message.tokenUsage ?? {};
  const prompt = finiteNumber(usage.prompt) ?? 0;
  const completion = finiteNumber(usage.completion) ?? 0;
  const explicitTotal = finiteNumber(usage.total);
  const total = explicitTotal ?? prompt + completion;
  const storedCost = finiteNumber(usage.estimated_cost_usd);
  const estimatedCost = storedCost ?? (message.model ? estimateModelCostUsd(message.model, prompt, completion) : null);
  return { prompt, completion, total, estimatedCost };
}

export function calculateTokenWallet(
  db: DemoDatabase,
  now = new Date(),
  monthlyAllowance = db.dashboardSettings[0]?.monthlyTokenAllowance ?? DEFAULT_MONTHLY_TOKEN_ALLOWANCE,
): TokenWalletSummary {
  const cycleStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const cycleEndDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const trailingStart = new Date(todayStart);
  trailingStart.setUTCDate(trailingStart.getUTCDate() - 6);
  const dailyUsage: DailyTokenUsage[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(trailingStart);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), tokens: 0 };
  });
  const dailyByDate = new Map(dailyUsage.map((item) => [item.date, item]));

  let consumedThisCycle = 0;
  let lifetimeConsumed = 0;
  let estimatedCostUsdThisCycle = 0;
  let lifetimeEstimatedCostUsd = 0;
  let costCoveredTokens = 0;

  for (const message of db.messages) {
    if (message.role !== "assistant") continue;
    const usage = messageTokenUsage(message);
    if (usage.total <= 0) continue;
    const createdAt = new Date(message.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;

    lifetimeConsumed += usage.total;
    if (usage.estimatedCost != null) {
      lifetimeEstimatedCostUsd += usage.estimatedCost;
      costCoveredTokens += usage.total;
    }
    if (createdAt >= cycleStartDate && createdAt < cycleEndDate) {
      consumedThisCycle += usage.total;
      if (usage.estimatedCost != null) estimatedCostUsdThisCycle += usage.estimatedCost;
    }
    const daily = dailyByDate.get(createdAt.toISOString().slice(0, 10));
    if (daily) daily.tokens += usage.total;
  }

  const normalizedAllowance = Math.max(0, Math.round(monthlyAllowance));
  const remainingThisCycle = Math.max(0, normalizedAllowance - consumedThisCycle);
  const last7DaysConsumed = dailyUsage.reduce((sum, item) => sum + item.tokens, 0);
  const dailyBurnRate = Math.round(last7DaysConsumed / 7);

  return {
    monthlyAllowance: normalizedAllowance,
    consumedThisCycle,
    remainingThisCycle,
    usagePercent: normalizedAllowance > 0 ? Math.round((consumedThisCycle / normalizedAllowance) * 1000) / 10 : 0,
    lifetimeConsumed,
    last7DaysConsumed,
    dailyBurnRate,
    projectedDaysRemaining: dailyBurnRate > 0 ? Math.ceil(remainingThisCycle / dailyBurnRate) : null,
    estimatedCostUsdThisCycle: Number(estimatedCostUsdThisCycle.toFixed(6)),
    lifetimeEstimatedCostUsd: Number(lifetimeEstimatedCostUsd.toFixed(6)),
    costCoveragePercent: lifetimeConsumed > 0 ? Math.round((costCoveredTokens / lifetimeConsumed) * 100) : 100,
    cycleStart: cycleStartDate.toISOString(),
    cycleEnd: cycleEndDate.toISOString(),
    dailyUsage,
  };
}

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
  language?: string | null;
  score?: number | null;
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

export function calculateEngagementSummary(db: DemoDatabase) {
  const visitorMessageCounts = new Map<string, number>();
  const assistantReplies = db.messages.filter((message) => message.role === "assistant" && message.metadata?.welcome !== true);
  for (const message of db.messages) {
    if (message.role !== "user") continue;
    visitorMessageCounts.set(message.conversationId, (visitorMessageCounts.get(message.conversationId) ?? 0) + 1);
  }
  const engagedConversations = [...visitorMessageCounts.values()].filter((count) => count >= 2).length;
  const conversationsWithQuestions = visitorMessageCounts.size;
  const groundedReplies = assistantReplies.filter((message) => !message.fallbackReason).length;
  const latencies = assistantReplies
    .map((message) => message.latencyMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const middle = Math.floor(latencies.length / 2);
  const medianResponseMs = latencies.length === 0
    ? null
    : latencies.length % 2
      ? latencies[middle]
      : Math.round((latencies[middle - 1] + latencies[middle]) / 2);
  return {
    engagedConversations,
    engagedConversationRate: conversationsWithQuestions > 0 ? Math.round((engagedConversations / conversationsWithQuestions) * 100) : null,
    groundedAnswerRate: assistantReplies.length > 0 ? Math.round((groundedReplies / assistantReplies.length) * 100) : null,
    medianResponseMs,
  };
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
        ,language: conversation.language ?? null
        ,score: (() => { const values = db.messages.filter((message) => message.conversationId === conversation.id && typeof message.qualityRating === "number").map((message) => message.qualityRating as number); return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null; })()
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
  const trackedConversationStarts = db.events.filter((event) => event.type === "conversation_started").length;
  // Conversations are the durable source of truth. Analytics events may have
  // been introduced after a merchant already had live conversations.
  const conversationStarts = db.conversations.length;
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
    ? Math.round((trackedConversationStarts / productPageViews) * 100)
    : null;
  const engagement = calculateEngagementSummary(db);

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
      ,...engagement
    },
    conversations: getConversationSummaries(db),
    products: db.products,
    insights: db.insights.sort((a, b) => b.count - a.count),
    insightSources: db.insightSources,
    integrations: db.platformIntegrations,
    syncJobs: db.syncJobs,
    guardrails: db.guardrails,
    settings: db.dashboardSettings[0],
    tokenWallet: calculateTokenWallet(db)
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
