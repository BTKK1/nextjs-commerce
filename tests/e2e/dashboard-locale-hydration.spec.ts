import { expect, test } from "@playwright/test";
import { watchPageForFailures } from "./support/page-watch";

test("Arabic dashboard hard loads and navigates without hydration mismatches", async ({ page, baseURL }) => {
  const watch = watchPageForFailures(page);
  await page.context().addCookies([{ name: "nbeh-dashboard-locale", value: "ar", url: baseURL ?? "http://127.0.0.1:3100" }]);

  await page.goto("/dashboard/agent/advanced", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("[data-dashboard-shell]")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("وصول التطوير المحلي", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Local development access", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "تعديل نبيه" })).toBeVisible();
  await expect(page.getByPlaceholder("اكتب أسلوب البيع والأولويات أو الحدود المطلوبة…")).toBeVisible();
  await expect(page.getByPlaceholder("Example: Shortened replies and clarified price objections")).toHaveCount(0);

  const playgroundLink = page.getByRole("link", { name: "اختبار الردود", exact: true });
  if (await playgroundLink.isVisible()) {
    await playgroundLink.click();
  } else {
    await page.getByRole("combobox", { name: "إعدادات المساعد" }).click();
    await page.getByRole("option", { name: "اختبار الردود", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/dashboard\/agent\/playground/);
  await expect(page.getByRole("heading", { name: "اختبر ردود نبيه قبل نشرها" })).toBeVisible();
  await watch.expectClean();
});

test("dashboard language switch reloads all page copy in the selected language", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "nbeh-dashboard-locale", value: "en", url: baseURL ?? "http://127.0.0.1:3100" }]);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("[data-dashboard-shell]")).toHaveAttribute("dir", "rtl");
  const menu = page.getByRole("button", { name: "فتح القائمة" });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole("link", { name: "المحادثات", exact: true })).toBeVisible();
});

test("every dashboard feature has an English and Arabic route heading", async ({ page, baseURL }) => {
  const routes = [
    ["/dashboard/conversations", "Conversations", "المحادثات"],
    ["/dashboard/insights", "Repeated questions and objections", "ما الذي يسأل عنه المتسوقون وما الذي يوقف الشراء؟"],
    ["/dashboard/products", "Product content quality", "حسّن معلومات المنتجات التي يحتاجها المتسوق"],
    ["/dashboard/agent", "Nbeh for Maison Vert", "نبيه لمتجر Maison Vert"],
    ["/dashboard/agent/advanced", "Edit Nbeh", "تعديل نبيه"],
    ["/dashboard/agent/playground", "Agent Playground", "اختبر ردود نبيه قبل نشرها"],
    ["/dashboard/agent/qa", "Test and publish", "الاختبار والنشر"],
    ["/dashboard/agent/versions", "Versions", "الإصدارات"],
    ["/dashboard/integrations", "Catalog provider status", "اربط متجرك ليعرف نبيه منتجاتك"],
    ["/dashboard/settings", "Merchant and Nbeh settings", "إعدادات المتجر ونبيه"],
    ["/dashboard/audit-log", "Audit Log", "سجل التغييرات"],
  ] as const;

  for (const [path, english, arabic] of routes) {
    await page.context().addCookies([{ name: "nbeh-dashboard-locale", value: "en", url: baseURL ?? "http://127.0.0.1:3100" }]);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: english })).toBeVisible();
    await page.context().addCookies([{ name: "nbeh-dashboard-locale", value: "ar", url: baseURL ?? "http://127.0.0.1:3100" }]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1, name: arabic })).toBeVisible();
  }
});

test("mobile dashboard navigation exposes every route without horizontal strips", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/agent/advanced", { waitUntil: "networkidle" });

  const menu = page.getByRole("button", { name: "Open menu" });
  await expect(menu).toBeVisible();
  await menu.click();
  for (const route of ["Overview", "Conversations", "Insights", "Products", "Agent", "Integrations", "Settings", "Audit Log"]) {
    await expect(page.getByRole("link", { name: route, exact: true })).toBeVisible();
  }
  await expect(page.locator("nav.overflow-x-auto")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
