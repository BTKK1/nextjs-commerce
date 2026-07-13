import { expect, type Page, test } from "@playwright/test";

const productSlugs = [
  "atelier-wool-coat",
  "noir-cashmere-crew",
  "high-rise-straight-denim",
  "poplin-oxford-shirt",
  "everyday-leather-tote",
  "pleated-linen-trouser",
  "silk-square-scarf",
  "ribbed-merino-tank"
];

async function gotoDemoPage(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

async function waitForProductInteractions(page: Page) {
  await expect(page.getByTestId("agent-widget")).toHaveAttribute("data-hydrated", "true", { timeout: 30_000 });
  await expect(page.getByTestId("agent-widget")).toHaveAttribute("data-open", "true");
  await expect(page.getByTestId("agent-input")).toBeEnabled();
  await expect(page.getByTestId("add-to-cart-demo")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("add-to-cart-demo")).toBeEnabled();
}

async function openAgentChat(page: Page) {
  if (!(await page.getByTestId("agent-input").isVisible().catch(() => false))) {
    await page.getByTestId("agent-chat-toggle").click();
  }
  await expect(page.getByTestId("agent-input")).toBeEnabled();
  await expect(page.getByTestId("agent-send")).toBeVisible();
}

async function closeAgentChatIfOpen(page: Page) {
  if (await page.getByTestId("agent-input").isVisible().catch(() => false)) {
    await page.getByLabel("Close product chat").click();
    await expect(page.getByTestId("agent-chat-toggle")).toBeVisible();
  }
}

async function sendAgentMessage(page: Page, message: string) {
  const assistantMessages = page.getByTestId("chat-message-assistant");
  const previousAssistantCount = await assistantMessages.count();

  await page.getByTestId("agent-input").fill(message);
  await expect(page.getByTestId("agent-send")).toBeEnabled();
  await page.getByTestId("agent-send").click();
  await expect(assistantMessages).toHaveCount(previousAssistantCount + 1, { timeout: 30_000 });
  await expect(page.getByTestId("agent-widget")).toHaveAttribute("data-sending", "false");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("home page loads Maison Vert storefront and all product links", async ({ page }) => {
  await gotoDemoPage(page, "/");
  await expect(page.getByRole("heading", { name: /Quiet clothes for a loud world/i })).toBeVisible();
  await expect(page.getByText("Complimentary shipping over $150")).toBeVisible();
  await expect(page.getByTestId("product-grid")).toBeVisible();
  await expect(page.getByTestId("agent-widget")).toHaveCount(0);
  for (const slug of productSlugs) {
    await expect(page.locator(`a[href="/product/${slug}"]`).first()).toBeVisible();
  }
});

test("each product page loads responsive image, size guide, and product-specific agent", async ({ page }) => {
  for (const slug of productSlugs) {
    await gotoDemoPage(page, `/product/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("product-image")).toBeVisible();
    await expect(page.getByTestId("product-image")).toHaveAttribute("src", /store-products/);
    await expect(page.getByText("Demo store only")).toHaveCount(0);
    await waitForProductInteractions(page);
    await openAgentChat(page);
    await expect(page.getByRole("heading", { name: "Maison Vert Assistant" })).toBeVisible();
    await expect(page.getByText(`Product guide for ${await page.getByRole("heading", { level: 1 }).textContent()}`)).toBeVisible();
    await expect(page.getByTestId("chat-messages").locator("p").first()).toContainText(
      String(await page.getByRole("heading", { level: 1 }).textContent()),
    );
    await page.getByLabel("Close product chat").click();

    await page.getByTestId("size-guide-button").click();
    await expect(page.getByTestId("size-guide-dialog")).toContainText("Size guide");
    await page.getByLabel("Close size guide").click();
  }
});

test("agent answers grounded question and falls back for missing warranty data", async ({ page }) => {
  await gotoDemoPage(page, "/product/atelier-wool-coat");
  await waitForProductInteractions(page);
  await openAgentChat(page);
  await sendAgentMessage(page, "Is this warm enough for winter?");
  await expect(page.getByTestId("chat-messages")).toContainText("Atelier Wool Coat");

  await sendAgentMessage(page, "Does it include a lifetime warranty?");
  await expect(page.getByTestId("chat-messages")).toContainText("Fallback: missing_catalog_field");
});

test("navbar Arabic toggle localizes product page and agent greeting while message language controls replies", async ({ page }) => {
  await gotoDemoPage(page, "/product/everyday-leather-tote");
  await waitForProductInteractions(page);
  await page.getByTestId("store-language-trigger").click();
  await page.getByTestId("store-language-option-ar").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "حقيبة جلد يومية" })).toBeVisible();
  await waitForProductInteractions(page);
  await openAgentChat(page);
  await expect(page.getByTestId("chat-messages")).toContainText("مرحبًا، أنا مساعد Maison Vert للمنتجات");
  await expect(page.getByTestId("chat-messages")).not.toContainText("Hi - I'm");

  await page.getByTestId("agent-input").fill("Does it include a lifetime warranty?");
  await page.getByTestId("agent-send").click();
  await expect(page.getByTestId("chat-messages")).toContainText("I do not have");
  await expect(page.getByTestId("chat-messages")).toContainText("التحويل الاحتياطي: missing_catalog_field");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1, name: "حقيبة جلد يومية" })).toBeVisible();
});

test("size and color selection are added to the bag and quantity controls work", async ({ page }) => {
  await gotoDemoPage(page, "/product/atelier-wool-coat");
  await waitForProductInteractions(page);
  await closeAgentChatIfOpen(page);
  await page.getByRole("button", { name: "Size M" }).click();
  await page.getByRole("button", { name: "Color Camel" }).click();
  await page.getByTestId("add-to-cart-demo").click();
  await expect(page.getByTestId("add-to-cart-demo")).toContainText("Added to bag");
  await expect(page.getByTestId("bag-count")).toContainText("(1)");

  await gotoDemoPage(page, "/cart");
  await expect(page.getByRole("heading", { name: "Your bag" })).toBeVisible();
  await expect(page.getByTestId("bag-item")).toContainText("Atelier Wool Coat");
  await expect(page.getByTestId("bag-item")).toContainText("Camel");
  await expect(page.getByTestId("bag-item")).toContainText("Size M");
  await page.getByLabel("Increase quantity").click();
  await expect(page.getByTestId("bag-item-quantity")).toContainText("2");
  await expect(page.getByTestId("bag-total")).toContainText("$978");
});

test("checkout accepts bag items and confirms a demo order", async ({ page }) => {
  await gotoDemoPage(page, "/product/everyday-leather-tote");
  await waitForProductInteractions(page);
  await closeAgentChatIfOpen(page);
  await page.getByTestId("buy-now").click();
  await expect(page.getByRole("heading", { name: "Your bag" })).toBeVisible();
  await expect(page.getByTestId("bag-item")).toContainText("Everyday Leather Tote");
  await expect(page).toHaveURL(/\/cart$/);
  await Promise.all([
    page.waitForURL(/\/checkout$/, { timeout: 30_000 }),
    page.getByRole("link", { name: "Proceed to checkout" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Email").fill("buyer@example.com");
  await page.getByLabel("First name").fill("Alex");
  await page.getByLabel("Last name").fill("Buyer");
  await page.getByLabel("Address").fill("12 Green Street");
  await page.getByLabel("City").fill("New York");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByLabel("Card number").fill("4242 4242 4242 4242");
  await page.getByLabel("Expiry (MM/YY)").fill("12/28");
  await page.getByLabel("CVC").fill("123");
  await page.getByTestId("place-order").click();
  await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible();
});

test("dashboard pages use Maison Vert seeded product context", async ({ page }) => {
  await gotoDemoPage(page, "/dashboard");
  await expect(page.getByRole("heading", { name: "Maison Vert" })).toBeVisible();
  await expect(page.getByTestId("dashboard-kpis")).toContainText("Unknown-answer rate");

  await gotoDemoPage(page, "/dashboard/conversations");
  await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();
  await expect(page.getByTestId("conversations-table")).toContainText("Atelier Wool Coat");

  await gotoDemoPage(page, "/dashboard/products");
  await expect(page.getByRole("heading", { name: "Content improvement view" })).toBeVisible();
  await expect(page.getByText("Suggested FAQ additions").first()).toBeVisible();
});
