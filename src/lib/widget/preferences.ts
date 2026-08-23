import "server-only";
import { resolveDataBackend } from "@/lib/backend/mode";
import { getActiveAgentConfig } from "@/lib/agent/config-repository";
import { normalizeAgentTone, normalizeArabicDialect, type AgentTonePreset, type ArabicDialect } from "@/lib/agent/welcome";
import { findSallaInstallation } from "@/lib/integrations/salla-store";
import { loadDatabase } from "@/lib/storage/json-store";
import { createServiceClient, hasSupabaseServiceConfig } from "@/utils/supabase/server";

export type WidgetSide = "left" | "right";

export interface WidgetPreferences {
  tonePreset: AgentTonePreset;
  arabicDialect: ArabicDialect;
  positionAr: WidgetSide;
  positionEn: WidgetSide;
  autoPopupEnabled: boolean;
  autoPopupDelaySeconds: number;
  teaserMessageAr: string;
  teaserMessageEn: string;
}

export const DEFAULT_WIDGET_PREFERENCES: WidgetPreferences = {
  tonePreset: "neutral_saudi",
  arabicDialect: "white_saudi",
  positionAr: "right",
  positionEn: "right",
  autoPopupEnabled: true,
  autoPopupDelaySeconds: 3,
  teaserMessageAr: "محتار؟ اسأل نبيه عن المنتج",
  teaserMessageEn: "Need help choosing? Ask Nbeh",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function side(value: unknown, fallback: WidgetSide): WidgetSide {
  return value === "left" || value === "right" ? value : fallback;
}

function delay(value: unknown): number {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate >= 0 && candidate <= 60 ? candidate : DEFAULT_WIDGET_PREFERENCES.autoPopupDelaySeconds;
}

function teaser(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim().slice(0, 120) : fallback;
}

export function parseWidgetPreferences(value: unknown): WidgetPreferences {
  const preferences = record(value);
  return {
    tonePreset: normalizeAgentTone(preferences.widget_tone_preset),
    arabicDialect: normalizeArabicDialect(preferences.widget_arabic_dialect),
    positionAr: side(preferences.widget_position_ar, DEFAULT_WIDGET_PREFERENCES.positionAr),
    positionEn: side(preferences.widget_position_en, DEFAULT_WIDGET_PREFERENCES.positionEn),
    autoPopupEnabled: typeof preferences.widget_auto_popup_enabled === "boolean" ? preferences.widget_auto_popup_enabled : DEFAULT_WIDGET_PREFERENCES.autoPopupEnabled,
    autoPopupDelaySeconds: delay(preferences.widget_auto_popup_delay_seconds),
    teaserMessageAr: teaser(preferences.widget_teaser_message_ar, DEFAULT_WIDGET_PREFERENCES.teaserMessageAr),
    teaserMessageEn: teaser(preferences.widget_teaser_message_en, DEFAULT_WIDGET_PREFERENCES.teaserMessageEn),
  };
}

export function widgetPreferencesToRecord(preferences: Pick<WidgetPreferences, "positionAr" | "positionEn" | "autoPopupEnabled" | "autoPopupDelaySeconds" | "teaserMessageAr" | "teaserMessageEn">): Record<string, unknown> {
  return {
    widget_position_ar: preferences.positionAr,
    widget_position_en: preferences.positionEn,
    widget_auto_popup_enabled: preferences.autoPopupEnabled,
    widget_auto_popup_delay_seconds: preferences.autoPopupDelaySeconds,
    widget_teaser_message_ar: preferences.teaserMessageAr,
    widget_teaser_message_en: preferences.teaserMessageEn,
  };
}

async function withAgentStyle(merchantId: string, preferences: WidgetPreferences): Promise<WidgetPreferences> {
  try {
    const config = await getActiveAgentConfig(merchantId);
    return {
      ...preferences,
      tonePreset: normalizeAgentTone(config.tonePreset),
      arabicDialect: normalizeArabicDialect(config.advancedSettings.arabic_tone),
    };
  } catch {
    return preferences;
  }
}

export async function loadWidgetPreferences(merchantKey: string): Promise<WidgetPreferences | null> {
  if (resolveDataBackend() === "local") {
    const database = loadDatabase();
    const installation = await findSallaInstallation(merchantKey);
    const merchant = database.merchants.find((item) => item.publicKey === merchantKey || item.id === merchantKey || item.id === installation?.merchantId);
    if (!merchant && !installation) return null;
    const merchantId = merchant?.id ?? installation?.merchantId;
    if (!merchantId) return null;
    const settings = database.dashboardSettings.find((item) => item.merchantId === merchantId) ?? database.dashboardSettings[0];
    const preferences = settings ? parseWidgetPreferences({
      widget_position_ar: settings.widgetPositionAr,
      widget_position_en: settings.widgetPositionEn,
      widget_auto_popup_enabled: settings.widgetAutoPopupEnabled,
      widget_auto_popup_delay_seconds: settings.widgetAutoPopupDelaySeconds,
      widget_teaser_message_ar: settings.widgetTeaserMessageAr,
      widget_teaser_message_en: settings.widgetTeaserMessageEn,
    }) : DEFAULT_WIDGET_PREFERENCES;
    return withAgentStyle(merchantId, preferences);
  }
  if (!hasSupabaseServiceConfig()) throw new Error("Supabase widget preferences are selected but server credentials are unavailable.");
  const supabase = createServiceClient();
  let merchantId: string | null = null;
  let merchantQuery = supabase.from("merchants").select("id").eq("public_key", merchantKey);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(merchantKey)) {
    merchantQuery = supabase.from("merchants").select("id").or(`public_key.eq.${merchantKey},id.eq.${merchantKey}`);
  }
  const { data: merchant, error: merchantError } = await merchantQuery.maybeSingle();
  if (merchantError) throw merchantError;
  merchantId = merchant?.id ? String(merchant.id) : null;
  if (!merchantId) {
    const { data: integration, error: integrationError } = await supabase.from("platform_integrations").select("merchant_id").in("provider", ["salla", "zid"]).eq("external_store_id", merchantKey).in("status", ["connected", "pending"]).limit(1).maybeSingle();
    if (integrationError) throw integrationError;
    merchantId = integration?.merchant_id ? String(integration.merchant_id) : null;
  }
  if (!merchantId) return null;
  const { data: settings, error: settingsError } = await supabase.from("dashboard_settings").select("dashboard_preferences").eq("merchant_id", merchantId).maybeSingle();
  if (settingsError) throw settingsError;
  return withAgentStyle(merchantId, parseWidgetPreferences(settings?.dashboard_preferences));
}
