import { expect, type APIRequestContext, test } from "@playwright/test";
import { watchPageForFailures } from "./support/page-watch";

async function chat(request: APIRequestContext, body: Record<string, unknown>) {
  const response = await request.post("/api/agent/chat", { data: body });
  expect(response.status()).toBe(200);
  return (await response.json()) as { conversationId: string; answer: string; fallbackReason?: string };
}

test("dashboard reflects conversations, transcript, insights, and demo provider status", async ({ page, request }) => {
  test.setTimeout(120_000);

  const watch = watchPageForFailures(page);
  const visitor = `anon-e2e-dashboard-${Date.now()}`;

  const first = await chat(request, {
    productSlug: "atelier-wool-coat",
    message: "It feels expensive.",
    visitorRef: visitor,
  });
  await chat(request, {
    productSlug: "atelier-wool-coat",
    message: "Can it be delivered today in Riyadh?",
    visitorRef: `${visitor}-missing-1`,
  });
  await chat(request, {
    productSlug: "atelier-wool-coat",
    message: "Can it be delivered today in Riyadh?",
    visitorRef: `${visitor}-missing-2`,
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("dashboard-kpis")).toContainText("Unknown-answer rate");

  await page.goto("/dashboard/conversations", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("conversations-table")).toContainText("Atelier Wool Coat");
  await expect(page.getByTestId("conversations-table")).toContainText("price concern");

  await page.goto(`/dashboard/conversations/${first.conversationId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Atelier Wool Coat/i })).toBeVisible();
  await expect(page.getByTestId("conversation-transcript").getByText("It feels expensive.")).toBeVisible();
  await expect(page.getByText("Atelier Wool Coat").first()).toBeVisible();

  await page.goto("/dashboard/insights", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("insight-summary")).toContainText("Repeated questions");
  await expect(page.getByTestId("insight-summary")).toContainText("Objections");
  await expect(page.getByText("missing_delivery_estimate").first()).toBeVisible();
  await expect(page.getByText("Warranty detail missing").first()).toBeVisible();
  await expect(page.getByText("missing catalog field").first()).toBeVisible();

  await page.goto("/dashboard/integrations", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Catalog provider status" })).toBeVisible();
  await expect(page.getByTestId("integrations-status")).toContainText("Demo Catalog");
  await expect(page.getByTestId("integrations-status")).toContainText("connected");
  await expect(page.getByTestId("integrations-status")).toContainText("Salla");
  await expect(page.getByTestId("integrations-status")).toContainText("not connected demo");
  await expect(page.getByTestId("integrations-status")).toContainText("Zid");
  await expect(page.getByTestId("integrations-status")).toContainText("Disabled until OAuth");
  await expect(page.getByTestId("integrations-status")).toContainText("keeps each store’s products and agent isolated");

  await watch.expectClean();
});

test("dashboard demo pages do not start customer auth session polling", async ({ page }) => {
  const sessionRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/session")) {
      sessionRequests.push(request.url());
    }
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("dashboard-kpis")).toBeVisible();

  await page.goto("/dashboard/conversations", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

  await expect.poll(() => sessionRequests.length).toBe(0);
});

test("dashboard navigation stays available and dense pages remain operable", async ({ page }) => {
  await page.goto("/dashboard/insights", { waitUntil: "domcontentloaded" });
  const sidebar = page.locator("aside");
  const mobileMenu = page.getByRole("button", { name: "Open menu" });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await expect(page.getByRole("link", { name: "Insights", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("Page 1");
  await expect(sidebar).toHaveCSS("position", "sticky");

  await page.evaluate(() => window.scrollTo(0, Math.min(1600, document.body.scrollHeight)));
  await expect.poll(async () => Math.round((await sidebar.boundingBox())?.y ?? -100)).toBeGreaterThanOrEqual(0);

  await page.goto("/dashboard/conversations", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Search")).toBeVisible();
  await expect(page.getByLabel("Product")).toBeVisible();
  await expect(page.getByLabel("Fallback reason")).toBeVisible();

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test("customer auth routes keep the NextAuth session boundary", async ({ page, request }) => {
  await page.goto("/customer/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  const session = await request.get("/api/auth/session");
  expect(session.status()).toBe(200);
  expect(await session.json()).toEqual({});
});
