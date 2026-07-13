import { createServiceClient, hasSupabaseServiceConfig } from "@/utils/supabase/server";
import { PRODUCT_AGENT_PROMPT_VERSION } from "@/lib/ai/model-config";
import { redactSensitiveText } from "@/lib/privacy/redaction";
import { loadDatabase } from "@/lib/storage/json-store";
import type {
  AgentAnswer,
  AgentPageContext,
  AnalyticsEvent,
  AuditLog,
  ConfigVersion,
  Conversation,
  DashboardSettings,
  DemoProduct,
  Guardrail,
  Insight,
  Message,
  Merchant,
  PlatformIntegration,
  SyncJob,
  Visitor,
  WebhookEvent
} from "@/lib/types";

export interface SupabaseSyncResult {
  enabled: boolean;
  ok: boolean;
  error?: string;
}

export interface ProductAgentActionLogInput {
  product: DemoProduct;
  conversationId: string;
  visitorRef: string;
  message: string;
  answer: AgentAnswer;
  fallbackReason?: string;
  pageContext?: AgentPageContext;
}

function enabled(): boolean {
  return process.env.SUPABASE_AGENT_ENABLED === "true" && hasSupabaseServiceConfig();
}

function safeError(error: unknown): string {
  if (!error) return "unknown";
  if (error instanceof Error) return error.message.slice(0, 240);
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message).slice(0, 240);
  return String(error).slice(0, 240);
}

function redactExcerpt(value: string): string {
  return redactSensitiveText(value.slice(0, 500));
}

async function checked<T>(promise: PromiseLike<{ error: T | null }>) {
  const { error } = await promise;
  if (error) throw error;
}

function merchantRow(merchant: Merchant) {
  return {
    id: merchant.id,
    name: merchant.name,
    arabic_name: merchant.arabicName,
    niche: merchant.industry,
    country: "SA",
    currency: "USD"
  };
}

function productRow(product: DemoProduct, merchantId: string) {
  return {
    id: product.id,
    merchant_id: merchantId,
    slug: product.slug,
    name: product.name,
    arabic_name: product.arabicName,
    category: product.category,
    price_sar: product.priceSar,
    compare_at_price_sar: product.compareAtPriceSar,
    availability: product.availability,
    inventory: product.inventory,
    catalog_payload: product,
    updated_at: new Date().toISOString()
  };
}

function visitorRow(visitor: Visitor) {
  return {
    id: visitor.id,
    anonymous_ref: visitor.anonymousRef,
    created_at: visitor.firstSeenAt
  };
}

function conversationRow(conversation: Conversation, visitorId: string | null) {
  return {
    id: conversation.id,
    merchant_id: conversation.merchantId,
    product_id: conversation.productId,
    visitor_id: visitorId,
    visitor_ref: conversation.visitorRef,
    status: conversation.status === "open" ? "active" : conversation.status,
    fallback_reason: conversation.fallbackReason,
    detected_objection: conversation.detectedObjection,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt
  };
}

function messageRow(message: Message) {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    role: message.role,
    content: redactSensitiveText(message.content),
    fallback_reason: message.fallbackReason,
    metadata: {
      quality_rating: message.qualityRating ?? null
    },
    created_at: message.createdAt
  };
}

function insightRow(insight: Insight) {
  return {
    id: insight.id,
    merchant_id: insight.merchantId,
    product_id: insight.productId,
    conversation_id: null,
    type: insight.type,
    title: insight.title,
    description: insight.detail,
    severity: insight.type === "unknown_answer" ? "high" : "medium",
    metadata: {
      product_slug: insight.productSlug,
      category: insight.category,
      count: insight.count
    },
    created_at: insight.createdAt,
    updated_at: insight.updatedAt
  };
}

function settingsRow(settings: DashboardSettings) {
  return {
    merchant_id: settings.merchantId,
    tone: settings.agentTone,
    demo_mode: settings.demoMode,
    retention_days: settings.retentionDays,
    refresh_label: settings.updatedAt
  };
}

function guardrailRow(guardrail: Guardrail) {
  return {
    id: guardrail.id,
    merchant_id: guardrail.merchantId,
    name: guardrail.name,
    enabled: guardrail.enabled,
    description: guardrail.description
  };
}

function integrationRow(integration: PlatformIntegration) {
  return {
    id: integration.id,
    merchant_id: integration.merchantId,
    provider: integration.provider,
    status: integration.status,
    description: integration.notes,
    connected_at: integration.connectedAt
  };
}

function syncJobRow(job: SyncJob) {
  return {
    id: job.id,
    merchant_id: job.merchantId,
    provider: job.provider,
    status: job.status,
    note: job.notes,
    created_at: job.startedAt
  };
}

function webhookEventRow(event: WebhookEvent) {
  return {
    id: event.id,
    merchant_id: event.merchantId,
    provider: event.provider,
    status: event.processedAt ? "processed" : "received",
    payload: { payload_summary: event.payloadSummary, processed_at: event.processedAt },
    note: event.eventType,
    created_at: event.receivedAt
  };
}

function configVersionRow(config: ConfigVersion) {
  return {
    id: config.id,
    merchant_id: config.merchantId,
    model: config.model,
    mode: config.mode,
    prompt_version: `v${config.version}`,
    created_at: config.createdAt
  };
}

function auditLogRow(log: AuditLog) {
  return {
    id: log.id,
    merchant_id: log.merchantId,
    actor: log.actor,
    action: log.action,
    metadata: { detail: log.detail },
    created_at: log.createdAt
  };
}

function analyticsEventRow(event: AnalyticsEvent) {
  return {
    id: event.id,
    merchant_id: event.merchantId,
    product_id: event.productId,
    product_slug: event.productSlug,
    visitor_ref: event.visitorRef,
    type: event.type,
    storefront_locale: event.storefrontLocale ?? null,
    created_at: event.createdAt
  };
}

export async function persistDemoSnapshotToSupabase(conversationId?: string): Promise<SupabaseSyncResult> {
  if (!enabled()) return { enabled: false, ok: true };

  try {
    const db = loadDatabase();
    const supabase = createServiceClient();
    const merchant = db.merchants[0];
    const conversation = conversationId ? db.conversations.find((item) => item.id === conversationId) : undefined;
    const visitor = conversation ? db.visitors.find((item) => item.anonymousRef === conversation.visitorRef) : undefined;

    await checked(supabase.from("merchants").upsert(db.merchants.map(merchantRow), { onConflict: "id" }));
    await checked(supabase.from("products").upsert(db.products.map((product) => productRow(product, merchant.id)), { onConflict: "id" }));

    if (db.dashboardSettings.length) {
      await checked(supabase.from("dashboard_settings").upsert(db.dashboardSettings.map(settingsRow), { onConflict: "merchant_id" }));
    }
    if (db.guardrails.length) {
      await checked(supabase.from("guardrails").upsert(db.guardrails.map(guardrailRow), { onConflict: "id" }));
    }
    if (db.platformIntegrations.length) {
      await checked(supabase.from("platform_integrations").upsert(db.platformIntegrations.map(integrationRow), { onConflict: "id" }));
    }
    if (db.syncJobs.length) {
      await checked(supabase.from("sync_jobs").upsert(db.syncJobs.map(syncJobRow), { onConflict: "id" }));
    }
    if (db.webhookEvents.length) {
      await checked(supabase.from("webhook_events").upsert(db.webhookEvents.map(webhookEventRow), { onConflict: "id" }));
    }
    if (db.configVersions.length) {
      await checked(supabase.from("config_versions").upsert(db.configVersions.map(configVersionRow), { onConflict: "id" }));
    }
    if (db.auditLogs.length) {
      await checked(supabase.from("audit_logs").upsert(db.auditLogs.map(auditLogRow), { onConflict: "id" }));
    }

    const visitors = visitor ? [visitor] : db.visitors;
    if (visitors.length) {
      await checked(supabase.from("visitors").upsert(visitors.map(visitorRow), { onConflict: "id" }));
    }

    const conversations = conversation ? [conversation] : db.conversations;
    if (conversations.length) {
      await checked(
        supabase
          .from("conversations")
          .upsert(
            conversations.map((item) => {
              const rowVisitor = db.visitors.find((candidate) => candidate.anonymousRef === item.visitorRef);
              return conversationRow(item, rowVisitor?.id ?? null);
            }),
            { onConflict: "id" }
          )
      );
    }

    const conversationIds = new Set(conversations.map((item) => item.id));
    const messages = conversation ? db.messages.filter((item) => conversationIds.has(item.conversationId)) : db.messages;
    if (messages.length) {
      await checked(supabase.from("messages").upsert(messages.map(messageRow), { onConflict: "id" }));
    }

    const productIds = new Set(conversations.map((item) => item.productId));
    const insights = conversation ? db.insights.filter((item) => productIds.has(item.productId)) : db.insights;
    if (insights.length) {
      await checked(supabase.from("insights").upsert(insights.map(insightRow), { onConflict: "id" }));
    }

    const events = conversation ? db.events.filter((item) => item.visitorRef === conversation.visitorRef) : db.events;
    if (events.length) {
      await checked(supabase.from("analytics_events").upsert(events.map(analyticsEventRow), { onConflict: "id" }));
    }

    return { enabled: true, ok: true };
  } catch (error) {
    console.error("[supabase-agent-sync] write failed:", safeError(error));
    return { enabled: true, ok: false, error: safeError(error) };
  }
}

export async function logProductAgentActionToSupabase(input: ProductAgentActionLogInput): Promise<SupabaseSyncResult> {
  if (!enabled()) return { enabled: false, ok: true };

  try {
    const supabase = createServiceClient();
    await checked(
      supabase.from("agent_actions").insert({
        agent: "product_sales_agent",
        action: input.fallbackReason ? "answer_fallback" : "answer",
        actor_kind: "ai",
        entity_kind: "conversation",
        entity_id: input.conversationId,
        provider: input.answer.provider ?? null,
        model: input.answer.model ?? null,
        prompt_version: input.answer.promptVersion ?? PRODUCT_AGENT_PROMPT_VERSION,
        provider_route: input.answer.providerRoute ?? input.answer.mode,
        prompt_tokens: input.answer.promptTokens ?? null,
        completion_tokens: input.answer.completionTokens ?? null,
        total_tokens: input.answer.totalTokens ?? null,
        estimated_cost: input.answer.estimatedCost ?? null,
        latency_ms: input.answer.latencyMs ?? null,
        input_snapshot: {
          product_slug: input.product.slug,
          visitor_ref: input.visitorRef,
          page_context: input.pageContext
            ? {
                path: input.pageContext.path ?? null,
                title: input.pageContext.title ?? null,
                product_name: input.pageContext.productName ?? null,
                locale: input.pageContext.locale ?? null
              }
            : null,
          message_chars: input.message.length,
          message_excerpt_redacted: redactExcerpt(input.message),
          language: input.answer.language,
          storefront_locale: input.pageContext?.locale ?? null
        },
        output: {
          answer_chars: input.answer.text.length,
          fallback_reason: input.fallbackReason ?? input.answer.fallbackReason ?? null,
          detected_objection: input.answer.detectedObjection ?? null,
          confidence: input.answer.confidence
        },
        reasoning:
          "Deterministic guardrails and catalog context run before the provider. The model can only answer from product context; unsupported facts fall back.",
        data_policy: {
          external_provider: input.answer.mode === "live",
          raw_secret_storage: false,
          pii_minimization: "Only a redacted shopper excerpt and aggregate metadata are stored in agent telemetry.",
          no_platform_write_tools: true
        },
        status: input.answer.fallbackReason ? "needs_review" : "ok",
        error_code: input.answer.errorCode ?? null,
        error_message: input.answer.errorMessage ?? null
      })
    );
    return { enabled: true, ok: true };
  } catch (error) {
    console.error("[supabase-agent-action] write failed:", safeError(error));
    return { enabled: true, ok: false, error: safeError(error) };
  }
}
