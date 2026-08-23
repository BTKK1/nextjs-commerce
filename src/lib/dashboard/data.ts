import "server-only";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import { getDashboardIdentity } from "@/lib/auth/require-user";
import { resolveDataBackend } from "@/lib/backend/mode";
import { loadDatabase } from "@/lib/storage/json-store";
import type { DemoDatabase, FallbackReason, Guardrail, ObjectionCategory, PlatformIntegration } from "@/lib/types";
import type { DashboardIdentity } from "@/lib/auth/require-user";
import { productFromSupabaseRow } from "@/lib/catalog/supabase-mapper";
import { getProviderReadiness } from "@/lib/integrations/registry";
import { parseWidgetPreferences } from "@/lib/widget/preferences";
import { readSallaInstallationState } from "@/lib/integrations/salla-store";
import { DEMO_MERCHANT_ID } from "@/lib/supabase/constants";

type Row = Record<string, unknown>;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function query(client: ReturnType<typeof createServiceClient> | Awaited<ReturnType<typeof createClient>>, table: string, merchantId: string) {
  const { data, error } = await client.from(table).select("*").eq("merchant_id", merchantId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

export async function loadDashboardDatabase(): Promise<DemoDatabase> {
  if (resolveDataBackend() === "local") {
    const database = loadDatabase();
    const state = await readSallaInstallationState();
    const founderStore = state.installations.find((installation) => installation.merchantId === DEMO_MERCHANT_ID);
    if (!founderStore) return database;
    return {
      ...database,
      products: [
        ...database.products.filter((product) => product.platform !== "salla"),
        ...founderStore.products.map((product) => ({ ...product, merchantId: DEMO_MERCHANT_ID })),
      ],
      platformIntegrations: [
        ...database.platformIntegrations.filter((integration) => integration.provider !== "salla"),
        {
          id: `salla-integration-${founderStore.storeId}`,
          merchantId: DEMO_MERCHANT_ID,
          provider: "salla",
          status: "connected",
          connectedAt: founderStore.connectedAt,
          notes: "Founder demo store connected through Salla Easy Mode.",
          externalStoreId: founderStore.storeId,
          lastSyncedAt: founderStore.lastSyncedAt,
          connectionReadiness: "connected",
        },
      ],
    };
  }
  const identity = await getDashboardIdentity();
  if (!identity) throw new Error("Merchant dashboard authentication is required.");

  {
    const client = identity.authMode === "founder" ? createServiceClient() : await createClient();
    const merchantResult = await client.from("merchants").select("*").eq("id", identity.merchantId).maybeSingle();
    if (merchantResult.error) throw merchantResult.error;
    const [products, visitors, conversations, messages, insights, insightSources, settings, guardrailRows, integrations, syncJobs, webhookEvents, auditLogs, events] = await Promise.all([
      query(client, "products", identity.merchantId), query(client, "visitors", identity.merchantId), query(client, "conversations", identity.merchantId),
      query(client, "messages", identity.merchantId), query(client, "insights", identity.merchantId), query(client, "insight_sources", identity.merchantId),
      query(client, "dashboard_settings", identity.merchantId), query(client, "guardrails", identity.merchantId), query(client, "platform_integrations", identity.merchantId),
      query(client, "sync_jobs", identity.merchantId), query(client, "webhook_events", identity.merchantId), query(client, "audit_logs", identity.merchantId),
      query(client, "analytics_events", identity.merchantId),
    ]);

    const productModels = products.map(productFromSupabaseRow);
    const productById = new Map(productModels.map((product) => [product.id, product]));
    const visitorById = new Map(visitors.map((visitor) => [string(visitor.id), visitor]));
    const dashboardSettings = settings[0];
    const preferences = object(dashboardSettings?.dashboard_preferences);
    const widgetPreferences = parseWidgetPreferences(preferences);
    const guardrails: Guardrail[] = guardrailRows.flatMap((row) => [
      { id: `${string(row.id)}-topics`, merchantId: identity.merchantId, name: "Allowed product topics", enabled: true, description: array(row.allowed_topics).join(", ") },
      { id: `${string(row.id)}-claims`, merchantId: identity.merchantId, name: "Blocked claims and topics", enabled: true, description: [...array(row.blocked_topics), ...array(row.blocked_claims)].join(", ") },
    ]);
    const integrationModels: PlatformIntegration[] = integrations.map((row) => ({
      id: string(row.id), merchantId: identity.merchantId,
      provider: (row.provider === "demo" ? "demo_catalog" : row.provider) as PlatformIntegration["provider"],
      status: (row.status === "not_connected" ? "not_connected_demo" : row.status) as PlatformIntegration["status"],
      connectedAt: row.connected_at ? string(row.connected_at) : null,
      notes: string(object(row.metadata_json).note, row.provider === "demo" ? "Temporary pilot catalog is connected." : `${String(row.provider).slice(0, 1).toUpperCase()}${String(row.provider).slice(1)} is ready for app approval and OAuth credentials.`),
      scopes: array(row.scopes).filter((scope): scope is string => typeof scope === "string"),
      externalStoreId: row.external_store_id ? string(row.external_store_id) : null,
      lastSyncedAt: row.last_synced_at ? string(row.last_synced_at) : null,
      connectionReadiness: row.status === "connected" ? "connected" : getProviderReadiness(row.provider === "demo" ? "demo_catalog" : row.provider as PlatformIntegration["provider"]).credentialsConfigured ? "ready" : "credentials_required",
    }));

    return {
      merchants: [{ id: identity.merchantId, publicKey: string(merchantResult.data?.public_key), name: string(merchantResult.data?.display_name, string(merchantResult.data?.business_name, "Merchant")), arabicName: string(merchantResult.data?.display_name, string(merchantResult.data?.business_name, "Merchant")), industry: "Ecommerce", city: "", demoMode: merchantResult.data?.platform_type === "demo" }],
      products: productModels,
      visitors: visitors.map((row) => ({ id: string(row.id), anonymousRef: string(row.anonymous_ref), firstSeenAt: string(row.first_seen_at), lastSeenAt: string(row.last_seen_at) })),
      conversations: conversations.map((row) => {
        const product = productById.get(string(row.product_id));
        const metadata = object(row.metadata_json);
        const visitor = visitorById.get(string(row.visitor_id));
        return { id: string(row.id), merchantId: identity.merchantId, productId: string(row.product_id), productSlug: product?.slug ?? string(metadata.product_slug), visitorRef: string(metadata.visitor_ref, string(visitor?.anonymous_ref, "anonymous")), status: string(row.status, "open") as "open" | "closed" | "needs_review", createdAt: string(row.started_at), updatedAt: string(row.ended_at, string(row.started_at)), fallbackReason: (string(metadata.fallback_reason) || null) as FallbackReason | null, detectedObjection: (string(metadata.detected_objection) || null) as ObjectionCategory | null, language: string(row.language) || null, metadata };
      }),
      messages: messages.map((row) => { const metadata = object(row.metadata_json); return { id: string(row.id), conversationId: string(row.conversation_id), role: (row.sender_type === "visitor" ? "user" : row.sender_type) as "user" | "assistant" | "system", content: string(row.content), createdAt: string(row.created_at), fallbackReason: string(row.fallback_reason) as never || null, qualityRating: metadata.quality_rating == null ? undefined : number(metadata.quality_rating), language: string(row.language) || null, model: string(row.model) || null, provider: string(row.provider) || null, tokenUsage: object(row.token_usage), latencyMs: row.latency_ms == null ? null : number(row.latency_ms), safetyFlags: object(row.safety_flags), metadata }; }),
      insights: insights.map((row) => { const product = productById.get(string(row.product_id)); const metadata = object(row.metadata_json); return { id: string(row.id), merchantId: identity.merchantId, productId: string(row.product_id), productSlug: product?.slug ?? string(metadata.product_slug), type: string(row.insight_type) as never, category: string(metadata.category, string(row.insight_type)), title: string(row.title), detail: string(row.content), count: number(row.frequency, 1), severity: string(row.severity, "medium") as "low" | "medium" | "high" | "critical", status: string(row.status, "open") as "open" | "reviewed" | "resolved" | "ignored", createdAt: string(row.created_at), updatedAt: string(row.updated_at) }; }),
      insightSources: insightSources.map((row) => ({ id: string(row.id), insightId: string(row.insight_id), conversationId: string(row.conversation_id), messageId: string(row.message_id), createdAt: string(row.created_at) })),
      dashboardSettings: [{ id: string(dashboardSettings?.id, "settings"), merchantId: identity.merchantId, agentTone: "neutral_saudi", retentionDays: number(preferences.retention_days, 90), demoMode: Boolean(preferences.demo_mode), updatedAt: string(dashboardSettings?.updated_at, new Date().toISOString()), refreshInterval: string(dashboardSettings?.refresh_interval, "manual"), widgetPositionAr: widgetPreferences.positionAr, widgetPositionEn: widgetPreferences.positionEn, widgetAutoPopupEnabled: widgetPreferences.autoPopupEnabled, widgetAutoPopupDelaySeconds: widgetPreferences.autoPopupDelaySeconds, widgetTeaserMessageAr: widgetPreferences.teaserMessageAr, widgetTeaserMessageEn: widgetPreferences.teaserMessageEn, monthlyTokenAllowance: Math.max(0, number(preferences.monthly_token_allowance, 1_000_000)) }],
      guardrails,
      platformIntegrations: integrationModels,
      syncJobs: syncJobs.map((row) => ({ id: string(row.id), merchantId: identity.merchantId, provider: (row.provider === "demo" ? "demo_catalog" : string(row.provider, "demo_catalog")) as PlatformIntegration["provider"], status: (row.status === "success" ? "completed" : row.status) as never, startedAt: string(row.started_at, string(row.created_at)), finishedAt: row.finished_at ? string(row.finished_at) : null, notes: string(object(row.metadata_json).note, string(row.resource)), resource: string(row.resource), recordsProcessed: number(row.records_processed), error: row.error ? string(row.error) : null })),
      webhookEvents: webhookEvents.map((row) => ({ id: string(row.id), merchantId: identity.merchantId, provider: (row.provider === "demo" ? "demo_catalog" : string(row.provider, "demo_catalog")) as PlatformIntegration["provider"], eventType: string(row.event_type), receivedAt: string(row.received_at), processedAt: row.processed_at ? string(row.processed_at) : null, payloadSummary: string(row.status), status: string(row.status, "received") as never })),
      configVersions: [],
      auditLogs: auditLogs.map((row) => ({ id: string(row.id), merchantId: identity.merchantId, action: string(row.action), actor: string(row.actor_type), createdAt: string(row.created_at), detail: string(object(row.details_json).reason, string(row.entity_type)) })),
      events: events.map((row) => ({ id: string(row.id), merchantId: identity.merchantId, productId: string(row.product_id), productSlug: string(row.product_slug, productById.get(string(row.product_id))?.slug ?? ""), visitorRef: string(row.visitor_ref, "anonymous"), storefrontLocale: (string(row.storefront_locale) || null) as "ar" | "en" | null, type: string(row.event_type) as never, createdAt: string(row.created_at) })),
    };
  }
}

export async function loadDashboardTeam(identity: DashboardIdentity): Promise<Array<{ userId: string; role: string; createdAt: string }>> {
  if (resolveDataBackend() === "local") return [{ userId: identity.userId ?? "local-demo", role: identity.role, createdAt: new Date().toISOString() }];
  const client = identity.authMode === "founder" ? createServiceClient() : await createClient();
  const { data, error } = await client.from("merchant_users").select("user_id,role,created_at").eq("merchant_id", identity.merchantId).order("created_at", { ascending: true });
  if (error) throw new Error(`merchant_users: ${error.message}`);
  return (data ?? []).map((row) => ({ userId: String(row.user_id), role: String(row.role), createdAt: String(row.created_at) }));
}
