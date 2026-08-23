import { after, NextResponse } from "next/server";
import { extractWebhookStoreId, isCommerceProvider, summarizeWebhookPayload, verifyWebhookSignature, verifyZidWebhookAuthorization, webhookEventKey } from "@/lib/integrations/registry";
import { installSallaStore, refreshSallaStore } from "@/lib/integrations/salla-installation";
import { refreshZidStore } from "@/lib/integrations/zid-installation";
import { resolveDataBackend } from "@/lib/backend/mode";
import { createServiceClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type WebhookStatus = "processed" | "failed";

async function markWebhookEvent(
  provider: "salla" | "zid",
  storeId: string,
  externalEventId: string,
  status: WebhookStatus,
  errorCode: string | null = null,
) {
  const supabase = createServiceClient();
  const { data: integration, error: integrationError } = await supabase
    .from("platform_integrations")
    .select("id")
    .eq("provider", provider)
    .eq("external_store_id", storeId)
    .maybeSingle();
  if (integrationError || !integration?.id) {
    console.error("[nbeh] webhook_status_integration_lookup_failed", provider);
    return;
  }
  const { error } = await supabase
    .from("webhook_events")
    .update({ status, processed_at: new Date().toISOString(), error: errorCode })
    .eq("integration_id", integration.id)
    .eq("provider", provider)
    .eq("external_event_id", externalEventId)
    .eq("status", "received");
  if (error) console.error("[nbeh] webhook_status_update_failed", provider, status);
}

function scheduleCatalogRefresh(provider: "salla" | "zid", storeId: string, externalEventId: string) {
  try {
    after(async () => {
      try {
        if (provider === "salla") await refreshSallaStore(storeId);
        else await refreshZidStore(storeId);
        await markWebhookEvent(provider, storeId, externalEventId, "processed");
      } catch {
        await markWebhookEvent(provider, storeId, externalEventId, "failed", "catalog_refresh_failed");
        console.error("[nbeh] webhook_catalog_refresh_failed", provider);
      }
    });
  } catch {
    // Unit tests call route handlers outside Next.js request storage. Production
    // requests always provide that storage and run this task after responding.
  }
}

function isUninstallEvent(provider: "salla" | "zid", event: string): boolean {
  if (provider === "zid") return event === "app.market.application.uninstall";
  return event === "app.store.uninstall" || event === "app.store.deleted" || event === "app.store.delete";
}

async function revokeStoreConnection(provider: "salla" | "zid", externalStoreId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("platform_integrations").update({
    status: "disabled",
    encrypted_credential_ref: null,
    metadata_json: { note: `${provider === "salla" ? "Salla" : "Zid"} app uninstalled; credentials revoked.` },
    updated_at: new Date().toISOString(),
  }).eq("provider", provider).eq("external_store_id", externalStoreId);
  return !error;
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!isCommerceProvider(provider)) return NextResponse.json({ error: "Unsupported commerce provider" }, { status: 404 });
  const body = await request.text();
  if (body.length > 1_000_000) return NextResponse.json({ error: "Webhook payload is too large" }, { status: 413 });
  const suppliedSignature = provider === "salla"
    ? request.headers.get("x-salla-signature") ?? request.headers.get("x-ai-sales-signature")
    : request.headers.get("x-ai-sales-signature") ?? request.headers.get("x-nbeh-webhook-token");
  const verified = verifyWebhookSignature(provider, body, suppliedSignature)
    || (provider === "zid" && verifyZidWebhookAuthorization(request.headers.get("authorization")));
  if (!verified) {
    return NextResponse.json({ error: "Invalid webhook signature or webhook secret is not configured" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return NextResponse.json({ error: "Webhook payload must be JSON" }, { status: 400 }); }
  const summary = summarizeWebhookPayload(payload);
  const externalStoreId = extractWebhookStoreId(payload);
  const externalEventId = webhookEventKey(summary);
  const eventType = String(summary.event);
  if (!externalStoreId) return NextResponse.json({ error: "Signed webhook payload is missing its store identity" }, { status: 400 });
  if (provider === "salla" && eventType === "app.store.authorize") {
    try {
      await installSallaStore(payload);
    } catch (error) {
      console.error("[nbeh] salla_store_authorization_failed", error instanceof Error ? error.message : "unknown error");
      return NextResponse.json({ error: "Could not finish the Salla store connection" }, { status: 503 });
    }
  }
  if (provider === "salla" && resolveDataBackend() === "local") {
    return NextResponse.json({ accepted: true, duplicate: false }, { status: 202 });
  }
  const supabase = createServiceClient();
  const { data: result, error } = await supabase.rpc("enqueue_webhook_event_atomic", {
    target_provider: provider,
    target_external_store_id: externalStoreId,
    target_external_event_id: externalEventId,
    target_event_type: eventType,
    sanitized_payload: summary,
    sanitized_headers: { content_type: request.headers.get("content-type"), user_agent: request.headers.get("user-agent") },
  });
  if (error) return NextResponse.json({ error: "Could not queue webhook" }, { status: 500 });
  if (!result) return NextResponse.json({ error: "Provider store is not connected" }, { status: 409 });
  if (result === "duplicate") {
    return NextResponse.json({ accepted: true, duplicate: true }, { status: 200 });
  }

  if (isUninstallEvent(provider, eventType)) {
    const revoked = await revokeStoreConnection(provider, externalStoreId);
    await markWebhookEvent(provider, externalStoreId, externalEventId, revoked ? "processed" : "failed", revoked ? null : "credential_revocation_failed");
    if (!revoked) return NextResponse.json({ error: "Could not revoke the store connection" }, { status: 503 });
    return NextResponse.json({ accepted: true, duplicate: false, uninstalled: true }, { status: 202 });
  }

  if (eventType.startsWith("product.") || eventType.startsWith("catalog.")) {
    scheduleCatalogRefresh(provider, externalStoreId, externalEventId);
  } else {
    await markWebhookEvent(provider, externalStoreId, externalEventId, "processed");
  }
  return NextResponse.json({ accepted: true, duplicate: false }, { status: 202 });
}
