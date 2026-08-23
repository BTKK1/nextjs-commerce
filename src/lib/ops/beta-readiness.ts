import "server-only";
import { getProviderReadiness } from "@/lib/integrations/registry";
import { DEMO_MERCHANT_ID } from "@/lib/supabase/constants";
import { createServiceClient } from "@/utils/supabase/server";

type Row = Record<string, unknown>;

export interface BetaReadinessCheck {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
}

export interface BetaReadinessSummary {
  capacityTarget: number;
  pilotInteractionTarget: number;
  activeMerchantCount: number;
  interactingMerchantCount: number;
  connectedStoreCount: number;
  conversationsLast30Days: number;
  engagedConversationsLast30Days: number;
  groundedAnswerRateLast24Hours: number | null;
  medianLatencyMsLast24Hours: number | null;
  fallbackRateLast24Hours: number | null;
  technicalReady: boolean;
  checks: BetaReadinessCheck[];
  capacityVerifiedAt: string | null;
}

function dateBefore(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function providerLaunchCheck(
  provider: "salla" | "zid",
  integrations: Row[],
  products: Row[],
  syncJobs: Row[],
): BetaReadinessCheck {
  const environment = getProviderReadiness(provider);
  const providerIntegrations = integrations.filter((row) => row.provider === provider);
  const connected = providerIntegrations.filter((row) => row.status === "connected");
  const launchable = connected.find((row) => {
    const integrationId = String(row.id ?? "");
    const merchantId = String(row.merchant_id ?? "");
    const hasCatalogProduct = products.some((product) => String(product.merchant_id ?? "") === merchantId && product.platform === provider);
    const hasSuccessfulSync = syncJobs.some((job) => String(job.integration_id ?? "") === integrationId && job.status === "success")
      || (Boolean(row.last_synced_at) && hasCatalogProduct);
    return Boolean(row.external_store_id)
      && Boolean(row.encrypted_credential_ref)
      && Boolean(row.last_synced_at)
      && hasSuccessfulSync
      && hasCatalogProduct;
  });

  const missing: string[] = [];
  if (!environment.credentialsConfigured) missing.push(...environment.missingEnvironmentVariables);
  if (!environment.webhookConfigured) missing.push(`${provider.toUpperCase()}_WEBHOOK_SECRET`);
  if (!connected.length) missing.push("a connected merchant install");
  if (connected.length && !connected.some((row) => Boolean(row.external_store_id))) missing.push("external store identity");
  if (connected.length && !connected.some((row) => Boolean(row.encrypted_credential_ref))) missing.push("encrypted store credential");
  if (connected.length && !connected.some((row) => Boolean(row.last_synced_at))) missing.push("completed catalog sync timestamp");
  if (connected.length && !connected.some((row) => Boolean(row.last_synced_at) && products.some((product) => product.platform === provider && String(product.merchant_id) === String(row.merchant_id)))
    && !syncJobs.some((job) => job.provider === provider && job.status === "success")) missing.push("successful catalog sync");
  if (connected.length && !products.some((product) => product.platform === provider && connected.some((row) => String(row.merchant_id) === String(product.merchant_id)))) missing.push("at least one synchronized product");

  const passed = environment.credentialsConfigured && environment.webhookConfigured && Boolean(launchable);
  return {
    id: provider,
    label: `${provider === "salla" ? "Salla" : "Zid"} production connection`,
    detail: passed
      ? `Production configuration, signed webhooks, encrypted credentials, catalog sync, and product context are verified for a connected ${provider === "salla" ? "Salla" : "Zid"} merchant.`
      : `Still required: ${[...new Set(missing)].join(", ") || "a fully synchronized merchant install"}.`,
    passed,
  };
}

export async function loadBetaReadiness(): Promise<BetaReadinessSummary> {
  const supabase = createServiceClient();
  const thirtyDaysAgo = dateBefore(30);
  const oneDayAgo = dateBefore(1);
  const staleBefore = dateBefore(1);
  const [
    merchantsResult,
    membershipsResult,
    integrationsResult,
    productsResult,
    syncJobsResult,
    conversationsResult,
    recentMessagesResult,
    webhookBacklogResult,
    capacityAuditResult,
  ] = await Promise.all([
    supabase.from("merchants").select("id,status,platform_type").eq("status", "active"),
    supabase.from("merchant_users").select("merchant_id"),
    supabase.from("platform_integrations").select("id,merchant_id,provider,status,last_synced_at,external_store_id,encrypted_credential_ref").in("provider", ["salla", "zid"]),
    supabase.from("products").select("merchant_id,platform"),
    supabase.from("sync_jobs").select("integration_id,provider,status,finished_at").in("provider", ["salla", "zid"]).order("created_at", { ascending: false }).limit(2_000),
    supabase.from("conversations").select("id,merchant_id").gte("started_at", thirtyDaysAgo),
    supabase.from("messages").select("conversation_id,merchant_id,sender_type,fallback_reason,latency_ms,provider,model,token_usage,metadata_json").gte("created_at", oneDayAgo).limit(20_000),
    supabase.from("webhook_events").select("id,status,received_at").in("status", ["received", "failed"]).limit(2_000),
    supabase.from("audit_logs").select("created_at,details_json").eq("merchant_id", DEMO_MERCHANT_ID).eq("action", "beta_capacity_verified").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [merchantsResult, membershipsResult, integrationsResult, productsResult, syncJobsResult, conversationsResult, recentMessagesResult, webhookBacklogResult, capacityAuditResult]) {
    if (result.error) throw result.error;
  }

  const merchants = (merchantsResult.data ?? []) as Row[];
  const memberships = new Set((membershipsResult.data ?? []).map((row) => String(row.merchant_id)));
  const integrations = (integrationsResult.data ?? []) as Row[];
  const products = (productsResult.data ?? []) as Row[];
  const syncJobs = (syncJobsResult.data ?? []) as Row[];
  const connected = integrations.filter((row) => row.status === "connected");
  const productMerchants = new Set(products.map((row) => String(row.merchant_id)));
  const conversations = (conversationsResult.data ?? []) as Row[];
  const recentMessages = (recentMessagesResult.data ?? []) as Row[];
  const webhookBacklog = (webhookBacklogResult.data ?? []) as Row[];
  const interactingMerchants = new Set(conversations.map((row) => String(row.merchant_id)));
  const visitorMessagesByConversation = new Map<string, number>();
  for (const message of recentMessages) {
    if (message.sender_type !== "visitor") continue;
    const id = String(message.conversation_id);
    visitorMessagesByConversation.set(id, (visitorMessagesByConversation.get(id) ?? 0) + 1);
  }
  const assistantMessages = recentMessages.filter((row) => row.sender_type === "assistant" && (row.metadata_json as Row | null)?.welcome !== true);
  const groundedAnswers = assistantMessages.filter((row) => !row.fallback_reason).length;
  const latencies = assistantMessages.map((row) => Number(row.latency_ms)).filter((value) => Number.isFinite(value) && value >= 0);
  const strandedMerchants = merchants.filter((row) => String(row.id) !== DEMO_MERCHANT_ID && !memberships.has(String(row.id)));
  const integrationErrors = integrations.filter((row) => row.status === "error");
  const staleConnected = connected.filter((row) => !row.last_synced_at || String(row.last_synced_at) < staleBefore);
  const productlessConnected = connected.filter((row) => !productMerchants.has(String(row.merchant_id)));
  const stuckWebhooks = webhookBacklog.filter((row) => row.status === "failed" || String(row.received_at) < new Date(Date.now() - 5 * 60_000).toISOString());
  const persistedLiveAnswers = assistantMessages.filter((row) => {
    const tokenUsage = row.token_usage && typeof row.token_usage === "object" ? row.token_usage as Row : {};
    return !row.fallback_reason && Boolean(row.provider) && Boolean(row.model) && Number(tokenUsage.total ?? 0) > 0;
  });
  const capacityVerifiedAt = capacityAuditResult.data?.created_at ? String(capacityAuditResult.data.created_at) : null;

  const checks: BetaReadinessCheck[] = [
    providerLaunchCheck("salla", integrations, products, syncJobs),
    providerLaunchCheck("zid", integrations, products, syncJobs),
    { id: "owners", label: "Merchant dashboard ownership", detail: strandedMerchants.length ? `${strandedMerchants.length} marketplace merchant(s) do not have a dashboard owner yet.` : "Every non-Founder merchant has a dashboard membership.", passed: strandedMerchants.length === 0 },
    { id: "integrations", label: "Connected store health", detail: integrationErrors.length || staleConnected.length ? `${integrationErrors.length} error state(s); ${staleConnected.length} stale catalog(s).` : "No connected integration is errored or more than 24 hours stale.", passed: integrationErrors.length === 0 && staleConnected.length === 0 },
    { id: "catalogs", label: "Product context availability", detail: productlessConnected.length ? `${productlessConnected.length} connected store(s) have no synchronized products.` : "Every connected store has product context.", passed: productlessConnected.length === 0 },
    { id: "webhooks", label: "Webhook processing", detail: stuckWebhooks.length ? `${stuckWebhooks.length} failed or stuck webhook event(s).` : "No failed or stuck webhook events.", passed: stuckWebhooks.length === 0 },
    { id: "live_chat", label: "Persisted live shopper conversation", detail: persistedLiveAnswers.length ? `${persistedLiveAnswers.length} grounded live answer(s) with provider, model, and token telemetry were persisted in the last 24 hours.` : "No successful persisted live shopper answer with provider and token telemetry was verified in the last 24 hours.", passed: persistedLiveAnswers.length > 0 },
    { id: "capacity", label: "100-merchant isolation test", detail: capacityVerifiedAt ? `Latest production verification passed at ${capacityVerifiedAt}.` : "A successful production capacity verification has not been recorded yet.", passed: Boolean(capacityVerifiedAt) },
  ];

  return {
    capacityTarget: 100,
    pilotInteractionTarget: 15,
    activeMerchantCount: merchants.length,
    interactingMerchantCount: interactingMerchants.size,
    connectedStoreCount: connected.length,
    conversationsLast30Days: conversations.length,
    engagedConversationsLast30Days: [...visitorMessagesByConversation.values()].filter((count) => count >= 2).length,
    groundedAnswerRateLast24Hours: assistantMessages.length ? Math.round((groundedAnswers / assistantMessages.length) * 100) : null,
    medianLatencyMsLast24Hours: median(latencies),
    fallbackRateLast24Hours: assistantMessages.length ? Math.round(((assistantMessages.length - groundedAnswers) / assistantMessages.length) * 100) : null,
    technicalReady: checks.every((check) => check.passed),
    checks,
    capacityVerifiedAt,
  };
}
