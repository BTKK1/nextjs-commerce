import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshSallaStore } from "@/lib/integrations/salla-installation";
import { refreshZidStore } from "@/lib/integrations/zid-installation";
import { createServiceClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ReconciliationFailure =
  | "reauthorization_required"
  | "credential_unreadable"
  | "provider_authentication_rejected"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "catalog_sync_failed";

function classifyFailure(error: unknown): ReconciliationFailure {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("requires reauthorization") || message.includes("missing its offline refresh token")) return "reauthorization_required";
  if (message.includes("credential reference") || message.includes("decrypt") || message.includes("authenticate data")) return "credential_unreadable";
  if (message.includes("status 401") || message.includes("status 403") || message.includes("refresh token")) return "provider_authentication_rejected";
  if (message.includes("status 429")) return "provider_rate_limited";
  if (/status 5\d\d/.test(message) || message.includes("timeout") || message.includes("fetch failed")) return "provider_unavailable";
  return "catalog_sync_failed";
}

function authorized(request: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!configured || configured.length < 32 || !supplied) return false;
  const expected = Buffer.from(configured);
  const candidate = Buffer.from(supplied);
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: integrations, error } = await supabase.from("platform_integrations")
    .select("id,provider,external_store_id")
    .in("provider", ["salla", "zid"])
    .in("status", ["connected", "pending", "error"])
    .not("external_store_id", "is", null)
    .not("encrypted_credential_ref", "is", null)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(4);
  if (error) return NextResponse.json({ error: "Could not load reconciliation queue" }, { status: 503 });

  const results = await Promise.all((integrations ?? []).map(async (integration) => {
    try {
      const records = integration.provider === "salla"
        ? await refreshSallaStore(String(integration.external_store_id))
        : await refreshZidStore(String(integration.external_store_id));
      return { provider: integration.provider, ok: true, records };
    } catch (error) {
      const reason = classifyFailure(error);
      await supabase.from("platform_integrations").update({
        status: "error",
        metadata_json: {
          note: `${integration.provider === "salla" ? "Salla" : "Zid"} remains installed, but scheduled catalog reconciliation failed. Nbeh will retry automatically.`,
          reconciliation_failure: reason,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", integration.id);
      console.error("[nbeh] catalog_reconciliation_failed", integration.provider, reason);
      return { provider: integration.provider, ok: false, records: 0, reason };
    }
  }));

  const failed = results.filter((result) => !result.ok).length;
  return NextResponse.json({
    ok: failed === 0,
    processed: results.length,
    failed,
    recordsProcessed: results.reduce((total, result) => total + result.records, 0),
    providers: [...new Set(results.map((result) => result.provider))],
    failures: results
      .filter((result) => !result.ok)
      .map((result) => ({ provider: result.provider, reason: result.reason })),
  }, { status: failed === results.length && results.length > 0 ? 503 : 200 });
}
