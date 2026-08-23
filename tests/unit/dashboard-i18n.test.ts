import { describe, expect, it } from "vitest";
import { dashboardArabic, translateDashboardText } from "@/lib/dashboard/translations";

describe("dashboard bilingual UI", () => {
  it("translates core navigation and action labels into Arabic", () => {
    expect(translateDashboardText("Overview", "ar")).toBe("نظرة عامة");
    expect(translateDashboardText("Test both agents", "ar")).toBe("اختبار المساعدين");
    expect(translateDashboardText("Save global configuration", "ar")).toBe("حفظ إعدادات نبيه العامة");
  });

  it("keeps English UI unchanged", () => {
    expect(translateDashboardText("Audit Log", "en")).toBe("Audit Log");
  });

  it("translates labels without losing JSX spacing", () => {
    expect(translateDashboardText(" System prompt ", "ar")).toBe(` ${dashboardArabic["System prompt"]} `);
    expect(translateDashboardText(" · Required", "ar")).toBe(` ${dashboardArabic["· Required"]}`);
  });

  it("localizes dynamic counts and pagination", () => {
    expect(translateDashboardText("2 matching conversations", "ar")).toBe("2 محادثة مطابقة");
    expect(translateDashboardText("Showing 1–25 of 40", "ar")).toBe("عرض 1–25 من 40");
    expect(translateDashboardText("Page 2 of 4", "ar")).toBe("صفحة 2 من 4");
  });

  it("covers every top-level dashboard route label", () => {
    for (const label of ["Global Agent", "Overview", "Conversations", "Insights", "Products", "Agent", "Integrations", "Settings", "Audit Log"]) {
      expect(dashboardArabic[label], label).toBeTruthy();
    }
  });

  it("does not present untracked business-impact labels", () => {
    const dashboardCopy = JSON.stringify(dashboardArabic).toLowerCase();
    for (const forbidden of ["conversion", "customer acquisition", "revenue lift", "sales lift"]) {
      expect(dashboardCopy).not.toContain(forbidden);
    }
  });
});
