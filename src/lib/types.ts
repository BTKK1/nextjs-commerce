export type AgentMode = "live";
export type StorefrontLocale = "en" | "ar";

export type FallbackReason =
  | "missing_catalog_field"
  | "out_of_scope"
  | "unsafe_request"
  | "low_confidence"
  | "model_error"
  | "rate_limited";

export type ObjectionCategory =
  | "price_concern"
  | "quality_concern"
  | "shipping_concern"
  | "suitability_concern"
  | "gift_concern"
  | "variant_confusion"
  | "maintenance_concern";

export type InsightType =
  | "repeated_question"
  | "objection"
  | "weak_description"
  | "unknown_answer";

export type AnalyticsEventType =
  | "widget_impression"
  | "chat_opened"
  | "conversation_started"
  | "message_sent"
  | "agent_answered"
  | "fallback_triggered"
  | "objection_detected"
  | "repeated_question_detected"
  | "product_page_view"
  | "demo_add_to_cart_clicked";

export type PlatformProvider = "demo_catalog" | "salla" | "zid";

export interface ProductVariant {
  name: string;
  values: string[];
  defaultValue?: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductFAQ {
  question: string;
  answer: string;
}

export interface ProductObjection {
  category: ObjectionCategory;
  objection: string;
  response: string;
}

export interface DemoProduct {
  id: string;
  slug: string;
  name: string;
  arabicName: string;
  category: string;
  tagline?: string;
  shortDescription: string;
  longDescription: string;
  priceSar: number;
  compareAtPriceSar: number | null;
  currency?: string;
  availability: string;
  inventory: number;
  variants: ProductVariant[];
  sizes?: string[];
  colors?: string[];
  material?: string;
  sizeGuide?: ProductSpec[];
  keyFeatures: string[];
  specs: ProductSpec[];
  careShippingNotes: string;
  faqs: ProductFAQ[];
  objections: ProductObjection[];
  weakDescriptionSignals: string[];
  imagePath: string;
  tags: string[];
  persona: string;
  upsellProductSlugs: string[];
  crossSellProductSlugs: string[];
}

export interface Merchant {
  id: string;
  name: string;
  arabicName: string;
  industry: string;
  city: string;
  demoMode: boolean;
}

export interface Visitor {
  id: string;
  anonymousRef: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface Conversation {
  id: string;
  merchantId: string;
  productId: string;
  productSlug: string;
  visitorRef: string;
  status: "open" | "closed" | "needs_review";
  createdAt: string;
  updatedAt: string;
  fallbackReason?: FallbackReason | null;
  detectedObjection?: ObjectionCategory | null;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  fallbackReason?: FallbackReason | null;
  qualityRating?: number;
}

export interface Insight {
  id: string;
  merchantId: string;
  productId: string;
  productSlug: string;
  type: InsightType;
  category: string;
  title: string;
  detail: string;
  count: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsightSource {
  id: string;
  insightId: string;
  conversationId: string;
  messageId: string;
  createdAt: string;
}

export interface DashboardSettings {
  id: string;
  merchantId: string;
  agentTone: "neutral_english";
  retentionDays: number;
  demoMode: boolean;
  updatedAt: string;
}

export interface Guardrail {
  id: string;
  merchantId: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface PlatformIntegration {
  id: string;
  merchantId: string;
  provider: PlatformProvider;
  status: "connected" | "not_connected_demo" | "disabled";
  connectedAt: string | null;
  notes: string;
}

export interface SyncJob {
  id: string;
  merchantId: string;
  provider: PlatformProvider;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  finishedAt: string | null;
  notes: string;
}

export interface WebhookEvent {
  id: string;
  merchantId: string;
  provider: PlatformProvider;
  eventType: string;
  receivedAt: string;
  processedAt: string | null;
  payloadSummary: string;
}

export interface ConfigVersion {
  id: string;
  merchantId: string;
  version: number;
  model: string;
  mode: AgentMode | string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  merchantId: string;
  action: string;
  actor: string;
  createdAt: string;
  detail: string;
}

export interface AnalyticsEvent {
  id: string;
  merchantId: string;
  productId: string;
  productSlug: string;
  visitorRef: string;
  type: AnalyticsEventType;
  storefrontLocale?: StorefrontLocale | null;
  createdAt: string;
}

export interface DemoDatabase {
  merchants: Merchant[];
  products: DemoProduct[];
  visitors: Visitor[];
  conversations: Conversation[];
  messages: Message[];
  insights: Insight[];
  insightSources: InsightSource[];
  dashboardSettings: DashboardSettings[];
  guardrails: Guardrail[];
  platformIntegrations: PlatformIntegration[];
  syncJobs: SyncJob[];
  webhookEvents: WebhookEvent[];
  configVersions: ConfigVersion[];
  auditLogs: AuditLog[];
  events: AnalyticsEvent[];
}

export interface AgentAnswer {
  text: string;
  fallbackReason?: FallbackReason;
  detectedObjection?: ObjectionCategory;
  confidence: number;
  mode: AgentMode;
  language: "ar" | "en";
  provider?: string | null;
  model?: string | null;
  providerRoute?: string;
  promptVersion?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCost?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface AgentConversationTurn {
  role: "assistant" | "user";
  content: string;
}

export interface AgentPageContext {
  url?: string;
  path?: string;
  title?: string;
  productName?: string;
  locale?: StorefrontLocale;
}
