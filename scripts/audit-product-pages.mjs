import { chromium, expect } from "@playwright/test";
import { join } from "node:path";
import catalog from "../src/data/demo-catalog.json" with { type: "json" };
import { acquirePreviewServer, baseHandoffEnv, root, writeJson, writeMarkdown } from "./lib/handoff-utils.mjs";

const findings = [];

function addFinding(severity, id, productSlug, detail) {
  findings.push({ severity, id, productSlug, detail });
}

function hasBlockingFinding() {
  return findings.some((finding) => ["P0", "P1", "P2"].includes(finding.severity));
}

async function cleanPageFailures(page, productSlug) {
  const failures = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("Download the React DevTools") || text.includes("favicon")) return;
    failures.push(`console error: ${text}`);
  });
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? "";
    if (url.includes("/_next/webpack-hmr") || url.includes("_rsc=")) return;
    if (url.includes("/_next/static/webpack/") && url.includes(".hot-update.")) return;
    if (errorText === "net::ERR_ABORTED" && url.includes("/api/events")) return;
    failures.push(`request failed: ${request.method()} ${url} ${errorText}`);
  });
  return () => {
    for (const failure of failures) addFinding("P0", "console_or_network_failure", productSlug, failure);
  };
}

async function visible(page, testId) {
  return page.getByTestId(testId).isVisible().catch(() => false);
}

async function auditProduct(browser, baseURL, product, viewport) {
  const page = await browser.newPage({ viewport });
  const flushFailures = await cleanPageFailures(page, product.slug);
  try {
    await page.goto(`${baseURL}/product/${product.slug}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.evaluate(() => window.localStorage.removeItem("maison-vert-bag"));

    if (!(await page.getByRole("heading", { level: 1 }).isVisible())) addFinding("P0", "missing_title", product.slug, "Product title is not visible.");
    if (!(await visible(page, "product-image"))) addFinding("P0", "missing_product_image", product.slug, "Product image is not visible.");
    if (!(await visible(page, "add-to-cart-demo"))) addFinding("P0", "missing_add_to_bag", product.slug, "Add-to-bag button is not visible.");
    const addToBagHydrated = await page
      .waitForFunction(() => document.querySelector('[data-testid="add-to-cart-demo"]')?.getAttribute("data-hydrated") === "true", null, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (!addToBagHydrated) {
      addFinding("P0", "add_to_bag_did_not_hydrate", product.slug, "Add-to-bag button did not hydrate within 30 seconds.");
      return;
    }
    const chatWidgetCount = await page.getByTestId("agent-widget").count().catch(() => 0);
    if (chatWidgetCount < 1) addFinding("P0", "missing_chat_widget", product.slug, "Agent widget is not mounted.");

    const openState = await page.getByTestId("agent-widget").getAttribute("data-open").catch(() => null);
    if (openState !== "true") addFinding("P1", "chat_not_open_by_default", product.slug, `Expected open product widget, got ${openState}.`);
    if (!(await visible(page, "agent-input"))) addFinding("P0", "chat_panel_not_open", product.slug, "Chat panel did not expose the input on product load.");

    const greetingNode = page.getByTestId("chat-messages").locator("p").first();
    await expect(greetingNode).toContainText(product.name, { timeout: 5_000 }).catch(() => undefined);
    const greeting = await greetingNode.textContent().catch(() => "");
    if (!greeting?.includes(product.name)) {
      addFinding("P1", "chat_greeting_not_product_specific", product.slug, `Greeting text: ${greeting}`);
    }

    await page.getByLabel(/close product chat/i).click();
    if (!(await visible(page, "agent-chat-toggle"))) addFinding("P1", "chat_bubble_missing_after_close", product.slug, "Chat bubble did not appear after closing the product panel.");
    await page.getByTestId("agent-chat-toggle").click();
    if (!(await visible(page, "agent-input"))) addFinding("P0", "chat_panel_did_not_reopen", product.slug, "Chat panel did not expose the input after reopening.");
    await page.keyboard.press("Escape");

    const colorButtons = await page.getByTestId("color-options").locator("button").count().catch(() => 0);
    if (colorButtons < 1) addFinding("P1", "missing_color_selector", product.slug, "No color selector button found.");
    if (colorButtons > 1) await page.getByTestId("color-options").locator("button").nth(1).click();

    const sizeButtons = await page.getByTestId("size-options").locator("button").count().catch(() => 0);
    if (sizeButtons < 1) addFinding("P1", "missing_size_selector", product.slug, "No size selector button found.");
    if (sizeButtons > 1) await page.getByTestId("size-options").locator("button").nth(1).click();

    await page.getByTestId("size-guide-button").click();
    if (!(await visible(page, "size-guide-dialog"))) addFinding("P1", "size_guide_did_not_open", product.slug, "Size guide dialog did not open.");
    await page.getByLabel(/close size guide/i).click();
    if (await visible(page, "size-guide-dialog")) addFinding("P1", "size_guide_did_not_close", product.slug, "Size guide dialog stayed open.");

    await page.getByTestId("add-to-cart-demo").click();
    await expect(page.getByTestId("add-to-cart-demo")).toContainText(/Added to bag|تمت الإضافة/i, { timeout: 10_000 });
    const addButtonText = await page.getByTestId("add-to-cart-demo").textContent().catch(() => "");
    if (!/added to bag|تمت الإضافة/i.test(addButtonText ?? "")) {
      addFinding("P1", "add_to_bag_no_feedback", product.slug, `Button text: ${addButtonText}`);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 2) addFinding("P1", "horizontal_overflow", product.slug, `Overflow: ${overflow}px`);

    await page.goto(`${baseURL}/cart`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("bag-item").first()).toBeVisible({ timeout: 10_000 });
    const bagText = await page.getByTestId("bag-item").first().textContent().catch(() => "");
    if (!bagText?.includes(product.name)) addFinding("P0", "cart_missing_added_product", product.slug, `Cart text: ${bagText}`);

    if (product.slug === catalog.products[0].slug && viewport.width >= 1000) {
      await page.getByLabel("Increase quantity").first().click();
      await expect(page.getByTestId("bag-item-quantity").first()).toContainText("2", { timeout: 10_000 });
      const quantity = await page.getByTestId("bag-item-quantity").first().textContent().catch(() => "");
      if (!quantity?.includes("2")) addFinding("P1", "quantity_control_failed", product.slug, `Quantity text: ${quantity}`);
      const checkoutLink = page.getByRole("link", { name: /proceed to checkout/i });
      await expect(checkoutLink).toBeVisible({ timeout: 10_000 });
      await checkoutLink.click();
      await page.waitForURL("**/checkout", { timeout: 10_000 }).catch(() => undefined);
      if (!(await page.getByRole("heading", { name: /checkout/i }).isVisible({ timeout: 10_000 }).catch(() => false))) {
        addFinding("P0", "checkout_shell_failed", product.slug, "Checkout page did not load.");
      }
    }
  } finally {
    flushFailures();
    await page.close();
  }
}

const env = baseHandoffEnv({ AGENT_MODE: "live" });
const preview = await acquirePreviewServer(env);
const browser = await chromium.launch();

try {
  for (const product of catalog.products) {
    await auditProduct(browser, preview.url, product, { width: 1440, height: 1000 });
    await auditProduct(browser, preview.url, product, { width: 390, height: 900 });
  }
} finally {
  await browser.close();
  await preview.cleanup();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseURL: preview.url,
  products: catalog.products.map((product) => product.slug),
  findings,
  passed: !hasBlockingFinding(),
};

writeJson(join(root, ".codex-loop", "product-page-audit.json"), report);
writeMarkdown(join(root, "PRODUCT_PAGE_AUDIT.md"), [
  "# Product Page Audit",
  "",
  `Generated: ${report.generatedAt}`,
  `Preview URL: ${preview.url}`,
  `Status: ${report.passed ? "PASS" : "FAIL"}`,
  "",
  "## Coverage",
  "",
  `- Product routes audited: ${report.products.length}`,
  "- Viewports: 1440x1000 desktop, 390x900 mobile",
  "- Checks: image, title, variants, size guide, add-to-bag, cart, quantity, checkout shell, chat bubble, overflow, console/network failures",
  "",
  "## Findings",
  "",
  findings.length ? findings.map((finding) => `- ${finding.severity} ${finding.id} ${finding.productSlug}: ${finding.detail}`).join("\n") : "- None",
  "",
]);

console.log(`Product page audit ${report.passed ? "passed" : "failed"} with ${findings.length} finding(s).`);
if (!report.passed) process.exit(1);
