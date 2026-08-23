import { expect, test } from "@playwright/test";
import { watchPageForFailures } from "./support/page-watch";

const productSlugs = [
  "atelier-wool-coat",
  "noir-cashmere-crew",
  "high-rise-straight-denim",
  "poplin-oxford-shirt",
  "everyday-leather-tote",
  "pleated-linen-trouser",
  "silk-square-scarf",
  "ribbed-merino-tank",
];

test("storefront smoke validates all products, compatibility alias, and local links", async ({ page }) => {
  const watch = watchPageForFailures(page);
  await page.goto("/store", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Quiet clothes for a loud world/i })).toBeVisible();
  await expect(page.getByTestId("product-grid")).toBeVisible();
  await expect(page.locator('[data-testid="product-grid"] article')).toHaveCount(productSlugs.length);
  await expect(page.getByTestId("agent-widget")).toHaveCount(0);

  for (const slug of productSlugs) {
    await expect(page.locator(`a[href="/store/product/${slug}"]`).first()).toBeVisible();
  }

  await page.locator(`a[href="/store/product/${productSlugs[0]}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/store/product/${productSlugs[0]}`));
  await expect(page.getByTestId("product-image")).toBeVisible();
  await expect(page.getByTestId("agent-widget")).toHaveAttribute("data-hydrated", "true", { timeout: 30_000 });
  if (!(await page.getByTestId("agent-input").isVisible().catch(() => false))) await page.getByTestId("agent-chat-toggle").click();
  await expect(page.getByTestId("chat-messages").locator("p").first()).toContainText("Atelier Wool Coat");

  await page.goto(`/products/${productSlugs[0]}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Atelier Wool Coat");

  await page.goto(`/product/${productSlugs[0]}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Atelier Wool Coat");

  await page.goto("/ar/store", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("agent-widget")).toHaveCount(0);
  await expect(page.locator(`a[href="/ar/store/product/${productSlugs[0]}"]`).first()).toBeVisible();
  await page.locator(`a[href="/ar/store/product/${productSlugs[0]}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/ar/store/product/${productSlugs[0]}`));
  await expect(page.getByTestId("agent-widget")).toHaveAttribute("data-dir", "rtl");
  if (!(await page.getByTestId("agent-input").isVisible().catch(() => false))) await page.getByTestId("agent-chat-toggle").click();
  await expect(page.getByTestId("agent-input")).toBeEnabled();

  await page.goto("/store", { waitUntil: "domcontentloaded" });
  const links = await page.locator('a[href^="/"]').evaluateAll((anchors) =>
    Array.from(new Set(anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href")?.split("#")[0]).filter(Boolean))),
  );
  for (const href of links) {
    const response = await page.request.get(href!);
    expect(response.status(), `${href} should not be broken`).toBeLessThan(400);
  }

  await watch.expectClean();
});
