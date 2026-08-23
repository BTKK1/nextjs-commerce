"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDashboardAdminUser } from "@/lib/auth/require-user";
import { createServiceClient } from "@/utils/supabase/server";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { resolveDataBackend } from "@/lib/backend/mode";
import { mutateDatabase } from "@/lib/storage/json-store";
import { widgetPreferencesToRecord, type WidgetPreferences } from "@/lib/widget/preferences";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function redirectSettingsFeedback(kind: "notice" | "error", message: string): never {
  redirect(`/dashboard/settings?${kind}=${encodeURIComponent(message)}#settings-feedback`);
}

export async function updateDashboardPreferencesAction(formData: FormData) {
  const identity = await requireDashboardAdminUser();
  const retentionDays = Number(formData.get("retention_days"));
  const refreshInterval = String(formData.get("refresh_interval") ?? "manual");
  if (!Number.isInteger(retentionDays) || retentionDays < 7 || retentionDays > 365) throw new Error("Retention must be between 7 and 365 days.");
  if (!["manual", "5m", "15m", "30m"].includes(refreshInterval)) throw new Error("Invalid refresh interval.");
  if (resolveDataBackend() === "local") {
    let settingsId = "settings";
    let previous: Record<string, unknown> = {};
    mutateDatabase((database) => {
      const settings = database.dashboardSettings.find((item) => item.merchantId === identity.merchantId) ?? database.dashboardSettings[0];
      if (!settings) throw new Error("Dashboard settings were not found.");
      settingsId = settings.id;
      previous = { retention_days: settings.retentionDays, refresh_interval: settings.refreshInterval };
      settings.retentionDays = retentionDays;
      settings.refreshInterval = refreshInterval;
      settings.updatedAt = new Date().toISOString();
    });
    await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "dashboard_preferences_updated", entityType: "dashboard_settings", entityId: settingsId, before: previous, after: { retention_days: retentionDays, refresh_interval: refreshInterval } });
    revalidatePath("/dashboard/settings");
    redirectSettingsFeedback("notice", "Preferences saved");
  }
  const supabase = createServiceClient();
  const { data: before, error: readError } = await supabase.from("dashboard_settings").select("id,dashboard_preferences,refresh_interval").eq("merchant_id", identity.merchantId).maybeSingle();
  if (readError || !before) throw readError ?? new Error("Dashboard settings were not found.");
  const dashboardPreferences = { ...record(before.dashboard_preferences), retention_days: retentionDays };
  const { error } = await supabase.from("dashboard_settings").update({ dashboard_preferences: dashboardPreferences, refresh_interval: refreshInterval }).eq("id", before.id).eq("merchant_id", identity.merchantId);
  if (error) throw error;
  await writeAuditLog({
    merchantId: identity.merchantId,
    actorUserId: identity.userId,
    action: "dashboard_preferences_updated",
    entityType: "dashboard_settings",
    entityId: before.id,
    before: { retention_days: record(before.dashboard_preferences).retention_days, refresh_interval: before.refresh_interval },
    after: { retention_days: retentionDays, refresh_interval: refreshInterval },
  });
  revalidatePath("/dashboard/settings");
  redirectSettingsFeedback("notice", "Preferences saved");
}

export async function updateWidgetPreferencesAction(formData: FormData) {
  const identity = await requireDashboardAdminUser();
  const preferences: Pick<WidgetPreferences, "positionAr" | "positionEn" | "autoPopupEnabled" | "autoPopupDelaySeconds" | "teaserMessageAr" | "teaserMessageEn"> = {
    positionAr: String(formData.get("widget_position_ar") ?? "right") as WidgetPreferences["positionAr"],
    positionEn: String(formData.get("widget_position_en") ?? "right") as WidgetPreferences["positionEn"],
    autoPopupEnabled: formData.get("widget_auto_popup_enabled") === "enabled",
    autoPopupDelaySeconds: Number(formData.get("widget_auto_popup_delay_seconds")),
    teaserMessageAr: String(formData.get("widget_teaser_message_ar") ?? "").trim(),
    teaserMessageEn: String(formData.get("widget_teaser_message_en") ?? "").trim(),
  };
  if (!["left", "right"].includes(preferences.positionAr) || !["left", "right"].includes(preferences.positionEn)) redirectSettingsFeedback("error", "Choose a valid widget position.");
  if (!Number.isInteger(preferences.autoPopupDelaySeconds) || preferences.autoPopupDelaySeconds < 0 || preferences.autoPopupDelaySeconds > 60) redirectSettingsFeedback("error", "Auto popup delay must be between 0 and 60 seconds.");
  if (preferences.teaserMessageAr.length > 120 || preferences.teaserMessageEn.length > 120) redirectSettingsFeedback("error", "The over-widget message must be 120 characters or fewer.");
  const next = widgetPreferencesToRecord(preferences);
  if (resolveDataBackend() === "local") {
    let settingsId = "settings";
    let before: Record<string, unknown> = {};
    try {
      mutateDatabase((database) => {
        const settings = database.dashboardSettings.find((item) => item.merchantId === identity.merchantId) ?? database.dashboardSettings[0];
        if (!settings) throw new Error("Dashboard settings were not found.");
        settingsId = settings.id;
        before = widgetPreferencesToRecord({
          positionAr: settings.widgetPositionAr ?? "right",
          positionEn: settings.widgetPositionEn ?? "right",
          autoPopupEnabled: settings.widgetAutoPopupEnabled ?? false,
          autoPopupDelaySeconds: settings.widgetAutoPopupDelaySeconds ?? 3,
          teaserMessageAr: settings.widgetTeaserMessageAr ?? "",
          teaserMessageEn: settings.widgetTeaserMessageEn ?? "",
        });
        settings.widgetPositionAr = preferences.positionAr;
        settings.widgetPositionEn = preferences.positionEn;
        settings.widgetAutoPopupEnabled = preferences.autoPopupEnabled;
        settings.widgetAutoPopupDelaySeconds = preferences.autoPopupDelaySeconds;
        settings.widgetTeaserMessageAr = preferences.teaserMessageAr;
        settings.widgetTeaserMessageEn = preferences.teaserMessageEn;
        settings.updatedAt = new Date().toISOString();
      });
      await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "widget_preferences_updated", entityType: "dashboard_settings", entityId: settingsId, before, after: next });
    } catch {
      redirectSettingsFeedback("error", "We couldn't save the widget settings. Try again.");
    }
    revalidatePath("/dashboard/settings");
    redirectSettingsFeedback("notice", "Widget settings saved");
  }
  try {
    const supabase = createServiceClient();
    const { data: before, error: readError } = await supabase.from("dashboard_settings").select("id,dashboard_preferences").eq("merchant_id", identity.merchantId).maybeSingle();
    if (readError || !before) throw readError ?? new Error("Dashboard settings were not found.");
    const dashboardPreferences = { ...record(before.dashboard_preferences), ...next };
    const { error } = await supabase.from("dashboard_settings").update({ dashboard_preferences: dashboardPreferences }).eq("id", before.id).eq("merchant_id", identity.merchantId);
    if (error) throw error;
    await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "widget_preferences_updated", entityType: "dashboard_settings", entityId: before.id, before: record(before.dashboard_preferences), after: next });
  } catch {
    redirectSettingsFeedback("error", "We couldn't save the widget settings. Try again.");
  }
  revalidatePath("/dashboard/settings");
  redirectSettingsFeedback("notice", "Widget settings saved");
}
