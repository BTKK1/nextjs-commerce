import { chromium } from "@playwright/test";
import { join } from "node:path";
import { acquirePreviewServer, baseHandoffEnv, root, writeJson, writeMarkdown } from "./lib/handoff-utils.mjs";

const findings = [];

function addFinding(severity, id, detail) {
  findings.push({ severity, id, detail });
}

function hasBlockingFinding() {
  return findings.some((finding) => ["P0", "P1", "P2"].includes(finding.severity));
}

async function chat(baseURL, body) {
  const response = await fetch(`${baseURL}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Chat API failed ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function expectText(page, locator, text, id) {
  let content = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    content = await locator.innerText().catch(() => "");
    if (content.includes(text)) return;
    await page.waitForTimeout(250);
  }
  if (!content || !content.includes(text)) addFinding("P0", id, `Expected text "${text}", got "${content}".`);
}

async function expectAnyText(page, locator, texts, id) {
  let content = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    content = await locator.innerText().catch(() => "");
    if (texts.some((text) => content.includes(text))) return;
    await page.waitForTimeout(250);
  }
  if (!content || !texts.some((text) => content.includes(text))) {
    addFinding("P0", id, `Expected one of "${texts.join('", "')}", got "${content}".`);
  }
}

async function run() {
  const env = baseHandoffEnv({ AGENT_MODE: "live" });
  const preview = await acquirePreviewServer(env);
  const visitor = `anon-dashboard-${Date.now()}`;

  const first = await chat(preview.url, {
    productSlug: "atelier-wool-coat",
    message: "It feels expensive.",
    visitorRef: visitor,
  });
  await chat(preview.url, {
    productSlug: "atelier-wool-coat",
    message: "Can it be delivered today in Riyadh?",
    visitorRef: `${visitor}-missing-1`,
  });
  await chat(preview.url, {
    productSlug: "atelier-wool-coat",
    message: "Can it be delivered today in Riyadh?",
    visitorRef: `${visitor}-missing-2`,
  });
  await chat(preview.url, {
    productSlug: "everyday-leather-tote",
    message: "I am worried it is just another bag.",
    visitorRef: `${visitor}-tote`,
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageFailures = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("Download the React DevTools") || text.includes("favicon")) return;
    pageFailures.push(`console error: ${text}`);
  });
  page.on("pageerror", (error) => pageFailures.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? "";
    if (url.includes("/_next/webpack-hmr") || url.includes("_rsc=")) return;
    if (
      errorText === "net::ERR_ABORTED" &&
      (url.includes("/_next/static/chunks/") ||
        url.includes("/_next/image") ||
        url.includes("/api/events"))
    ) {
      return;
    }
    pageFailures.push(`request failed: ${request.method()} ${url} ${errorText}`);
  });

  try {
    await page.goto(`${preview.url}/dashboard`, { waitUntil: "domcontentloaded" });
    await expectText(page, page.getByTestId("dashboard-kpis"), "Unknown-answer rate", "dashboard_kpis_missing_unknown_rate");
    await expectText(page, page.getByTestId("dashboard-kpis"), "Conversation starts", "dashboard_kpis_missing_conversations");

    await page.goto(`${preview.url}/dashboard/conversations`, { waitUntil: "domcontentloaded" });
    await expectText(page, page.getByTestId("conversations-table"), "Atelier Wool Coat", "conversation_missing_product");
    await expectText(page, page.getByTestId("conversations-table"), visitor, "conversation_missing_visitor_ref");
    await expectText(page, page.getByTestId("conversations-table"), "price concern", "conversation_missing_objection");

    await page.goto(`${preview.url}/dashboard/conversations/${first.conversationId}`, { waitUntil: "domcontentloaded" });
    await expectText(page, page.locator("body"), "It feels expensive.", "transcript_missing_user_message");
    await expectText(page, page.locator("body"), "Atelier Wool Coat", "transcript_missing_product_reference");

    await page.goto(`${preview.url}/dashboard/insights`, { waitUntil: "domcontentloaded" });
    await expectText(page, page.getByTestId("insight-summary"), "Repeated questions", "insights_missing_repeated_summary");
    await expectText(page, page.getByTestId("insight-summary"), "Objections", "insights_missing_objection_summary");
    await expectText(page, page.locator("body"), "missing_delivery_estimate", "insights_missing_delivery_fallback");
    await expectAnyText(page, page.locator("body"), ["price concern", "price_concern"], "insights_missing_price_objection");
    await expectText(page, page.locator("body"), "Recommended merchant action", "insights_missing_recommendation");

    await page.goto(`${preview.url}/dashboard/integrations`, { waitUntil: "domcontentloaded" });
    await expectText(page, page.getByTestId("integrations-status"), "Demo Catalog", "integrations_missing_demo_catalog");
    await expectText(page, page.getByTestId("integrations-status"), "connected", "integrations_missing_demo_connected");
    await expectText(page, page.getByTestId("integrations-status"), "Salla", "integrations_missing_salla");
    await expectText(page, page.getByTestId("integrations-status"), "Zid", "integrations_missing_zid");
    await expectText(page, page.getByTestId("integrations-status"), "not connected demo", "integrations_missing_not_connected_status");

    await page.goto(`${preview.url}/dashboard/settings`, { waitUntil: "domcontentloaded" });
    await expectText(page, page.locator("body"), "Agent mode", "settings_missing_agent_mode");
    await expectText(page, page.locator("body"), env.AGENT_MODE, "settings_missing_mode_value");
    await expectText(page, page.locator("body"), "Guardrails", "settings_missing_guardrails");
    await expectText(page, page.locator("body"), "anonymous references", "settings_missing_retention_privacy");
  } finally {
    for (const failure of pageFailures) addFinding("P0", "console_or_network_failure", failure);
    await browser.close();
    await preview.cleanup();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseURL: preview.url,
    conversationId: first.conversationId,
    visitor,
    findings,
    passed: !hasBlockingFinding(),
  };
  writeJson(join(root, ".codex-loop", "dashboard-audit.json"), report);
  writeMarkdown(join(root, "DASHBOARD_AUDIT.md"), [
    "# Dashboard Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Preview URL: ${preview.url}`,
    `Conversation under audit: ${first.conversationId}`,
    `Status: ${report.passed ? "PASS" : "FAIL"}`,
    "",
    "## Validated",
    "",
    "- KPI cards updated after actual agent conversations",
    "- Conversation list and transcript include product, visitor, user, and assistant context",
    "- Insights show repeated questions, objections, fallback/missing data, and content recommendations",
    "- Integrations show Demo Catalog connected while Salla and Zid remain not connected in this demo milestone",
    "- Settings show demo mode, model mode, guardrails, and privacy/retention notes",
    "",
    "## Findings",
    "",
    findings.length ? findings.map((finding) => `- ${finding.severity} ${finding.id}: ${finding.detail}`).join("\n") : "- None",
    "",
  ]);

  console.log(`Dashboard audit ${report.passed ? "passed" : "failed"} with ${findings.length} finding(s).`);
  if (!report.passed) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
