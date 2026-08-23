"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/server";
import { requireDashboardUser } from "@/lib/auth/require-user";
import { canManageProducts } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { resolveDataBackend } from "@/lib/backend/mode";
import { mutateDatabase } from "@/lib/storage/json-store";

export async function updateInsightStatusAction(formData: FormData) {
  const identity = await requireDashboardUser();
  if (!canManageProducts(identity.role)) redirect("/dashboard/insights?error=This%20role%20has%20read-only%20access#dashboard-feedback");
  const insightId = String(formData.get("insight_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!insightId || !["open", "reviewed", "resolved", "ignored"].includes(status)) redirect("/dashboard/insights?error=Choose%20a%20valid%20insight%20status#dashboard-feedback");
  try {
    if (resolveDataBackend() === "local") {
      let beforeStatus = "";
      mutateDatabase((database) => {
        const insight = database.insights.find((item) => item.id === insightId && item.merchantId === identity.merchantId);
        if (!insight) throw new Error("Insight was not found.");
        beforeStatus = insight.status ?? "open";
        insight.status = status as typeof insight.status;
        insight.updatedAt = new Date().toISOString();
      });
      await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "insight_status_updated", entityType: "insight", entityId: insightId, before: { status: beforeStatus }, after: { status } });
    } else {
      const supabase = createServiceClient();
      const { data: before, error: beforeError } = await supabase.from("insights").select("status").eq("id", insightId).eq("merchant_id", identity.merchantId).maybeSingle();
      if (beforeError || !before) throw beforeError ?? new Error("Insight was not found.");
      const { error } = await supabase.from("insights").update({ status }).eq("id", insightId).eq("merchant_id", identity.merchantId);
      if (error) throw error;
      await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "insight_status_updated", entityType: "insight", entityId: insightId, before, after: { status } });
    }
  } catch (error) {
    console.error("[nbeh] update_insight_status_failed", error instanceof Error ? error.message : "unknown error");
    redirect("/dashboard/insights?error=The%20insight%20status%20could%20not%20be%20saved#dashboard-feedback");
  }
  revalidatePath("/dashboard/insights");
  redirect(`/dashboard/insights?notice=${encodeURIComponent(`Insight marked ${status}.`)}#dashboard-feedback`);
}
