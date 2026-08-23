import "server-only";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import type { DashboardIdentity } from "@/lib/auth/require-user";
import { resolveDataBackend } from "@/lib/backend/mode";
import { loadDatabase, mutateDatabase } from "@/lib/storage/json-store";
import { randomUUID } from "node:crypto";

export async function writeAuditLog(input: {
  merchantId: string;
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  details?: Record<string, unknown>;
}) {
  if (resolveDataBackend() !== "supabase") {
    mutateDatabase((database) => {
      database.auditLogs.unshift({
        id: randomUUID(), merchantId: input.merchantId, action: input.action,
        actor: input.actorUserId ? "user" : "system", createdAt: new Date().toISOString(),
        detail: JSON.stringify({ entity_type: input.entityType ?? null, entity_id: input.entityId ?? null, before: input.before ?? null, after: input.after ?? null, ...(input.details ?? {}) }),
      });
    });
    return;
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_logs").insert({
    merchant_id: input.merchantId,
    actor_user_id: input.actorUserId ?? null,
    actor_type: input.actorUserId ? "user" : "system",
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    before_json: input.before ?? null,
    after_json: input.after ?? null,
    details_json: input.details ?? {},
  });
  if (error) throw new Error(`Audit log write failed: ${error.message}`);
}

export async function getAuditLogsForDashboard(identity: DashboardIdentity) {
  if (resolveDataBackend() !== "supabase") {
    const store = loadDatabase();
    const possibleLogs = (store as unknown as { auditLogs?: Array<Record<string, unknown>> }).auditLogs ?? [];
    return possibleLogs
      .map((log): Record<string, unknown> => ({
        ...log,
        merchant_id: log.merchant_id ?? log.merchantId,
        created_at: log.created_at ?? log.createdAt,
        actor_type: log.actor_type ?? log.actor ?? "system",
        entity_type: log.entity_type ?? log.entityType ?? null,
        details_json: log.details_json ?? (log.detail ? { summary: log.detail } : {}),
      }))
      .sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")))
      .slice(0, 100);
  }
  const client = identity.authMode === "founder" ? createServiceClient() : await createClient();
  const { data, error } = await client.from("audit_logs").select("*").eq("merchant_id", identity.merchantId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Audit log read failed: ${error.message}`);
  return (data ?? []) as Array<Record<string, unknown>>;
}
