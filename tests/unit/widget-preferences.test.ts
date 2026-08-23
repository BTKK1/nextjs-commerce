import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_PREFERENCES, parseWidgetPreferences, widgetPreferencesToRecord } from "@/lib/widget/preferences";
import { GET } from "@/app/api/widget/preferences/route";
import { GET as getWidgetConfig } from "@/app/api/widget/config/route";
import { resetDatabaseForTests } from "@/lib/storage/json-store";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAgentWelcomeMessage } from "@/lib/agent/welcome";

describe("widget preferences", () => {
  it("serves public merchant widget settings without requiring product context", async () => {
    resetDatabaseForTests();
    const response = await GET(new Request("https://www.nbeh.io/api/widget/preferences?merchantKey=demo-maison-vert", { headers: { origin: "https://shop.example" } }));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://shop.example");
    expect(await response.json()).toMatchObject({
      tonePreset: "neutral_saudi",
      arabicDialect: "white_saudi",
      positionAr: "left",
      positionEn: "right",
      autoPopupEnabled: true,
    });
  });

  it("serves canonical product names to a cross-origin Salla storefront", async () => {
    resetDatabaseForTests();
    const response = await getWidgetConfig(new Request("https://www.nbeh.io/api/widget/config?merchantKey=demo-maison-vert&productRef=atelier-wool-coat", {
      headers: { origin: "https://demo-store.salla.sa" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://demo-store.salla.sa");
    expect(await response.json()).toMatchObject({ product: { name: "Atelier Wool Coat" } });
  });

  it("accepts seven-character Zid store IDs at the public API boundary", async () => {
    resetDatabaseForTests();
    const preferences = await GET(new Request("https://www.nbeh.io/api/widget/preferences?merchantKey=3220733"));
    const config = await getWidgetConfig(new Request("https://www.nbeh.io/api/widget/config?merchantKey=3220733&productRef=product-1"));

    expect(preferences.status).toBe(404);
    expect(config.status).toBe(404);
  });

  it("uses safe merchant defaults for an empty preference record", () => {
    expect(parseWidgetPreferences({})).toEqual(DEFAULT_WIDGET_PREFERENCES);
  });

  it("round-trips placement, popup, and closed-widget message controls without merchant-authored onboarding", () => {
    const preferences = {
      positionAr: "left" as const,
      positionEn: "right" as const,
      autoPopupEnabled: false,
      autoPopupDelaySeconds: 8,
      teaserMessageAr: "اسأل نبيه قبل ما تختار",
      teaserMessageEn: "Ask Nbeh before you choose",
    };
    const record = widgetPreferencesToRecord(preferences);
    expect(record).not.toHaveProperty("widget_onboarding_message_ar");
    expect(record).not.toHaveProperty("widget_onboarding_message_en");
    expect(record).toMatchObject({
      widget_teaser_message_ar: preferences.teaserMessageAr,
      widget_teaser_message_en: preferences.teaserMessageEn,
    });
    expect(parseWidgetPreferences(record)).toEqual({
      tonePreset: "neutral_saudi",
      arabicDialect: "white_saudi",
      ...preferences,
    });
  });

  it("rejects malformed public values by falling back instead of exposing them", () => {
    expect(parseWidgetPreferences({
      widget_position_ar: "center",
      widget_auto_popup_delay_seconds: 999,
      widget_tone_preset: "not-a-tone",
      widget_arabic_dialect: "not-a-dialect",
    })).toMatchObject({
      tonePreset: DEFAULT_WIDGET_PREFERENCES.tonePreset,
      arabicDialect: DEFAULT_WIDGET_PREFERENCES.arabicDialect,
      positionAr: DEFAULT_WIDGET_PREFERENCES.positionAr,
      autoPopupDelaySeconds: DEFAULT_WIDGET_PREFERENCES.autoPopupDelaySeconds,
    });
  });

  it("generates the welcome from tone, dialect, and the exact product name", () => {
    const productName = "عباية لينورا السوداء";
    expect(buildAgentWelcomeMessage(productName, "ar", "store", {
      tonePreset: "warm_concise",
      arabicDialect: "najdi",
    })).toContain(productName);
    expect(buildAgentWelcomeMessage("Lenora Black Abaya", "en", "store", {
      tonePreset: "consultative",
      arabicDialect: "hijazi",
    })).toContain("Lenora Black Abaya");
  });

  it("makes dashboard saves visibly pending and unmistakably successful", () => {
    const settingsPage = readFileSync(join(process.cwd(), "src/app/dashboard/settings/page.tsx"), "utf8");
    const submitButton = readFileSync(join(process.cwd(), "src/components/dashboard/SettingsSubmitButton.tsx"), "utf8");
    const actions = readFileSync(join(process.cwd(), "src/app/dashboard/settings/actions.ts"), "utf8");

    expect(settingsPage).toContain("searchParams");
    expect(settingsPage).toContain("ActionFeedback");
    expect(settingsPage).toContain('successTitle={query.notice === "Widget settings saved"');
    expect(settingsPage).toContain('pendingLabel="Saving widget settings…"');
    expect(submitButton).toContain("useFormStatus");
    expect(submitButton).toContain("disabled={pending}");
    expect(actions).toContain("#settings-feedback");
    expect(actions).toContain('redirectSettingsFeedback("notice", "Widget settings saved")');
    expect(actions).toContain('redirectSettingsFeedback("error", "We couldn\'t save the widget settings. Try again.")');
    expect(settingsPage).toContain("Welcome message is automatic");
    expect(settingsPage).toContain('name="widget_teaser_message_ar"');
    expect(settingsPage).toContain('name="widget_teaser_message_en"');
    expect(settingsPage).toContain("WidgetSettingsPreview");
    expect(settingsPage).not.toContain("widget_onboarding_message_ar");
    expect(settingsPage).not.toContain("widget_onboarding_message_en");
  });
});
