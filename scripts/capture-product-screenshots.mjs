import { chromium } from "@playwright/test";
import { join } from "node:path";
import catalog from "../src/data/demo-catalog.json" with { type: "json" };
import { acquirePreviewServer, baseHandoffEnv, ensureDir, readJson, root, writeJson, writeMarkdown } from "./lib/handoff-utils.mjs";

const statePath = join(root, ".codex-loop", "state.json");
const state = readJson(statePath, { iteration: Number(process.env.CODEX_LOOP_ITERATION || 1) });
const iteration = Number(process.env.CODEX_LOOP_ITERATION || state.iteration || 1);
const screenshotRoot = join(root, ".codex-loop", "screenshots", `iteration-${iteration}`);
const desktopViewports = [
  { name: "1440x1200", width: 1440, height: 1200 },
  { name: "1280x900", width: 1280, height: 900 },
];
const mobileViewports = [
  { name: "390x1200", width: 390, height: 1200 },
  { name: "430x932", width: 430, height: 932 },
];

function severityRank(severity) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[severity] ?? 3;
}

function addFinding(findings, severity, id, productSlug, viewport, detail) {
  findings.push({ severity, id, productSlug, viewport, detail });
}

function isIgnorableDevPageError(error) {
  if (process.env.PLAYWRIGHT_USE_BUILD_SERVER === "1") return false;
  const message = error.message || "";
  const stack = error.stack || "";
  if (message.includes("Router action dispatched before initialization") && stack.includes("hot-reloader")) return true;
  if (message.includes("Invalid or unexpected token") && stack.trim() === "SyntaxError: Invalid or unexpected token") return true;
  return false;
}

async function auditPage(page, product, viewport, baseURL, findings) {
  const failures = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("Download the React DevTools") || text.includes("favicon")) return;
    failures.push(`console error: ${text}`);
  });
  page.on("pageerror", (error) => {
    if (isIgnorableDevPageError(error)) return;
    failures.push(`page error: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? "";
    if (url.includes("/_next/webpack-hmr") || url.includes("_rsc=")) return;
    if (url.includes("/_next/static/webpack/") && url.includes(".hot-update.")) return;
    failures.push(`request failed: ${request.method()} ${url} ${errorText}`);
  });

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseURL}/product/${product.slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const agentHydrated = await page
    .waitForFunction(() => document.querySelector('[data-testid="agent-widget"]')?.getAttribute("data-hydrated") === "true", null, {
      timeout: 5_000,
    })
    .then(() => true)
    .catch(() => false);
  if (!agentHydrated) {
    addFinding(findings, "P1", "agent_not_hydrated_for_screenshot", product.slug, viewport.name, "Agent widget did not hydrate before screenshot capture.");
  }

  const imageLoaded = await page.getByTestId("product-image").evaluate((img) => {
    const image = img;
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  });
  if (!imageLoaded) {
    addFinding(findings, "P0", "broken_product_image", product.slug, viewport.name, "Product image did not load with natural dimensions.");
  }

  const metrics = await page.evaluate(() => {
    const image = document.querySelector('[data-testid="product-image"]')?.getBoundingClientRect();
    const addToBag = document.querySelector('[data-testid="add-to-cart-demo"]')?.getBoundingClientRect();
    const chat = document.querySelector('[data-testid="agent-chat-toggle"]')?.getBoundingClientRect();
    const title = document.querySelector("h1")?.getBoundingClientRect();
    const bodyOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const overlap =
      addToBag && chat
        ? !(chat.left > addToBag.right || chat.right < addToBag.left || chat.top > addToBag.bottom || chat.bottom < addToBag.top)
        : false;
    return {
      image: image ? { width: image.width, height: image.height, top: image.top, bottom: image.bottom } : null,
      title: title ? { width: title.width, height: title.height, top: title.top } : null,
      horizontalOverflow: bodyOverflow,
      chatOverlapsAddToBag: overlap,
    };
  });

  if (!metrics.image || metrics.image.width < 220 || metrics.image.height < 260) {
    addFinding(findings, "P1", "image_too_small", product.slug, viewport.name, `Image metrics: ${JSON.stringify(metrics.image)}`);
  }
  if (!metrics.title || metrics.title.width < 120 || metrics.title.height < 24) {
    addFinding(findings, "P0", "missing_product_title", product.slug, viewport.name, "Product title was not visible.");
  }
  if (metrics.horizontalOverflow > 2) {
    addFinding(findings, "P1", "horizontal_overflow", product.slug, viewport.name, `Overflow: ${metrics.horizontalOverflow}px`);
  }
  if (metrics.chatOverlapsAddToBag) {
    addFinding(findings, "P1", "chat_overlaps_add_to_bag", product.slug, viewport.name, "Collapsed chat bubble overlaps add-to-bag button.");
  }
  for (const failure of failures) {
    addFinding(findings, "P0", "console_or_network_failure", product.slug, viewport.name, failure);
  }
}

const env = baseHandoffEnv({ AGENT_MODE: "live" });
const preview = await acquirePreviewServer(env);
const browser = await chromium.launch();
const findings = [];
const screenshots = [];

try {
  for (const product of catalog.products) {
    for (const viewport of desktopViewports) {
      const dir = join(screenshotRoot, "desktop");
      ensureDir(dir);
      const page = await browser.newPage();
      await auditPage(page, product, viewport, preview.url, findings);
      const path = join(dir, `${product.slug}-${viewport.name}.png`);
      await page.screenshot({ path, fullPage: true, caret: "initial", timeout: 20_000 });
      screenshots.push({ productSlug: product.slug, viewport: viewport.name, type: "desktop", path });
      await page.close();
    }

    for (const viewport of mobileViewports) {
      const dir = join(screenshotRoot, "mobile");
      ensureDir(dir);
      const page = await browser.newPage({ isMobile: true });
      await auditPage(page, product, viewport, preview.url, findings);
      const path = join(dir, `${product.slug}-${viewport.name}.png`);
      await page.screenshot({ path, fullPage: true, caret: "initial", timeout: 20_000 });
      screenshots.push({ productSlug: product.slug, viewport: viewport.name, type: "mobile", path });
      await page.close();
    }
  }
} finally {
  await browser.close();
  await preview.cleanup();
}

const report = {
  generatedAt: new Date().toISOString(),
  iteration,
  baseURL: preview.url,
  screenshotRoot,
  screenshots,
  findings,
  passed: findings.every((finding) => severityRank(finding.severity) > 2),
};

writeJson(join(root, ".codex-loop", "screenshot-audit.json"), report);
writeMarkdown(join(root, "SCREENSHOT_AUDIT.md"), [
  "# Screenshot Audit",
  "",
  `Generated: ${report.generatedAt}`,
  `Iteration: ${iteration}`,
  `Preview URL: ${preview.url}`,
  `Screenshots: ${screenshotRoot}`,
  `Status: ${report.passed ? "PASS" : "FAIL"}`,
  "",
  "## Coverage",
  "",
  `- Products: ${catalog.products.length}`,
  `- Desktop screenshots: ${catalog.products.length * desktopViewports.length}`,
  `- Mobile screenshots: ${catalog.products.length * mobileViewports.length}`,
  "",
  "## Findings",
  "",
  findings.length
    ? findings.map((finding) => `- ${finding.severity} ${finding.id} ${finding.productSlug} ${finding.viewport}: ${finding.detail}`).join("\n")
    : "- None",
  "",
]);

console.log(`Wrote screenshot audit for ${screenshots.length} screenshots.`);
if (!report.passed) process.exit(1);
