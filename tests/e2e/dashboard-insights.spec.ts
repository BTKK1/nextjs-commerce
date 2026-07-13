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
  await expect(page.getByText("Fallback or unknown-answer event").first()).toBeVisible();

  await page.goto("/dashboard/integrations", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Catalog provider status" })).toBeVisible();
  await expect(page.getByTestId("integrations-status")).toContainText("Demo Catalog");
  await expect(page.getByTestId("integrations-status")).toContainText("connected");
  await expect(page.getByTestId("integrations-status")).toContainText("Salla");
  await expect(page.getByTestId("integrations-status")).toContainText("not connected demo");
  await expect(page.getByTestId("integrations-status")).toContainText("Zid");
  await expect(page.getByTestId("integrations-status")).toContainText("No Salla calls are made");
  await expect(page.getByTestId("integrations-status")).toContainText("No Zid calls are made");

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

test("customer auth routes keep the NextAuth session boundary", async ({ page }) => {
  const sessionRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/session")) {
      sessionRequests.push(request.url());
    }
  });

  await page.goto("/customer/login", { waitUntil: "domcontentloaded" });

  await expect.poll(() => sessionRequests.length).toBeGreaterThan(0);
});
