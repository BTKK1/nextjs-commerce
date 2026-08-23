import { chromium } from "@playwright/test";
import axe from "axe-core";

const baseUrl = (process.env.PRODUCTION_SMOKE_URL || "https://www.nbeh.io").replace(/\/$/, "");
const founderEmail = process.env.PRODUCTION_SMOKE_FOUNDER_EMAIL || "Founder@nbeh.io";
const founderPassword = process.env.PRODUCTION_SMOKE_FOUNDER_PASSWORD;
const founderMerchantKey = process.env.PRODUCTION_SMOKE_MERCHANT_KEY || "a28ee8e8-4267-4514-bbf8-b277d07040d0";
const requireBetaReady = process.env.REQUIRE_PRODUCTION_BETA_READY !== "false";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertOk(response, label) {
  assert(response.ok(), `${label} returned ${response.status()}`);
  return response;
}

async function run() {
  assert(founderPassword, "PRODUCTION_SMOKE_FOUNDER_PASSWORD is required for the Founder production smoke test.");
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();
  const failures = [];
  let successfulEventResponses = 0;
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource")) failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url() === `${baseUrl}/api/events`) return;
    failures.push(`request: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    if (response.url() === `${baseUrl}/api/events` && response.ok()) successfulEventResponses += 1;
    if (response.status() < 400 || response.url().includes("_rsc=")) return;
    failures.push(`response: ${response.status()} ${response.url()}`);
  });

  try {
    const [landing, login, health, sallaLoader, zidLoader, preferences] = await Promise.all([
      context.request.get("/"),
      context.request.get("/login"),
      context.request.get("/api/agent/health"),
      context.request.get("/salla-widget.js"),
      context.request.get("/zid-widget.js"),
      context.request.get(`/api/widget/preferences?merchantKey=${encodeURIComponent(founderMerchantKey)}`),
    ]);
    for (const [response, label] of [[landing, "landing"], [login, "login"], [health, "health"], [sallaLoader, "Salla loader"], [zidLoader, "Zid loader"], [preferences, "widget preferences"]]) {
      await assertOk(response, label);
    }

    const healthPayload = await health.json();
    assert(healthPayload.status === "ok", `Agent health is ${healthPayload.status}`);
    assert(healthPayload.dataBackend === "supabase", `Unexpected data backend: ${healthPayload.dataBackend}`);
    assert(healthPayload.databaseReachable === true, "Production database is unreachable");
    assert(healthPayload.persistenceConfigured === true, "Production persistence is not configured");
    assert(healthPayload.commerceProvidersConfigured === true, "Salla or Zid production configuration is incomplete");
    assert((await sallaLoader.text()) === (await zidLoader.text()), "Salla and Zid are not serving the same branded widget loader");

    const preferencePayload = await preferences.json();
    assert(preferencePayload.positionAr === "left", "Founder Arabic widget position is not left");
    assert(preferencePayload.positionEn === "right", "Founder English widget position is not right");
    assert(typeof preferencePayload.teaserMessageAr === "string" && preferencePayload.teaserMessageAr.length > 0, "Arabic teaser is missing");
    assert(typeof preferencePayload.teaserMessageEn === "string" && preferencePayload.teaserMessageEn.length > 0, "English teaser is missing");

    await page.goto("/store/product/everyday-leather-tote", { waitUntil: "networkidle" });
    await page.getByTestId("agent-chat-toggle").click();
    await page.getByTestId("chat-messages").waitFor({ state: "visible" });
    await page.getByTestId("chat-messages").getByText("Everyday Leather Tote", { exact: false }).waitFor({ state: "visible", timeout: 10_000 });
    const assistantMessages = page.getByTestId("chat-message-assistant");
    const assistantCountBefore = await assistantMessages.count();
    const chatResponsePromise = page.waitForResponse((response) => response.url() === `${baseUrl}/api/agent/chat` && response.request().method() === "POST", { timeout: 60_000 });
    await page.getByTestId("agent-input").fill("What is the exact price and one honest trade-off for using this as a work bag?");
    await page.getByTestId("agent-send").click();
    const chatResponse = await chatResponsePromise;
    assert(chatResponse.status() === 200, `Live shopper chat returned ${chatResponse.status()}`);
    const chatPayload = await chatResponse.json();
    assert(typeof chatPayload.conversationId === "string" && chatPayload.conversationId.length > 0, "Live shopper chat did not return a conversation ID");
    assert(typeof chatPayload.answer === "string" && chatPayload.answer.length > 10, "Live shopper chat returned an empty answer");
    assert(!chatPayload.fallbackReason, `Live shopper chat unexpectedly fell back: ${chatPayload.fallbackReason}`);
    await assistantMessages.nth(assistantCountBefore).waitFor({ state: "visible", timeout: 60_000 });
    const shopperSession = await page.evaluate(() => {
      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        if (!key?.startsWith("nbeh-agent:") || key.includes(":messages:") || key.includes(":memory:") || key.includes(":session-id:")) continue;
        try {
          const value = JSON.parse(window.sessionStorage.getItem(key) || "null");
          if (value?.conversationId && value?.visitorRef) return value;
        } catch {
          // Ignore unrelated or legacy session keys.
        }
      }
      return null;
    });
    assert(shopperSession?.visitorRef, "Widget did not persist the anonymous visitor reference");
    const transcript = await context.request.get(`/api/agent/chat?${new URLSearchParams({
      conversationId: chatPayload.conversationId,
      merchantKey: founderMerchantKey,
      productSlug: "everyday-leather-tote",
      visitorRef: shopperSession.visitorRef,
    }).toString()}`);
    await assertOk(transcript, "durable shopper transcript");
    const transcriptPayload = await transcript.json();
    assert(transcriptPayload.messages?.some((message) => message.role === "user" && message.content.includes("honest trade-off")), "Shopper message was not durably persisted");
    assert(transcriptPayload.messages?.some((message) => message.role === "assistant" && message.content === chatPayload.answer), "Assistant answer was not durably persisted");

    await page.goto("/login", { waitUntil: "networkidle" });
    await page.locator('input[name="email"]').fill(founderEmail);
    await page.locator('input[name="password"]').fill(founderPassword);
    await page.getByRole("button", { name: "Sign in to Nbeh" }).click();
    await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 20_000 });
    await page.goto("/dashboard/platform", { waitUntil: "networkidle" });
    await page.getByTestId("beta-readiness").waitFor({ state: "visible" });
    const readiness = await page.getByTestId("beta-readiness").evaluate((root) => {
      const checks = [...root.querySelectorAll("[data-readiness-check]")].map((element) => ({
        id: element.getAttribute("data-readiness-check"),
        passed: element.getAttribute("data-passed") === "true",
        text: element.textContent || "",
      }));
      return { text: root.textContent || "", checks };
    });
    const readinessText = readiness.text;
    const allReadinessChecksPassed = readiness.checks.length > 0 && readiness.checks.every((check) => check.passed);
    assert(readinessText.includes(allReadinessChecksPassed ? "Ready for controlled beta" : "Production work still required"), `Founder readiness headline does not match its checks:\n${readinessText}`);
    assert(readiness.checks.some((check) => check.id === "salla"), "Salla readiness check is missing");
    assert(readiness.checks.some((check) => check.id === "zid"), "Zid readiness check is missing");
    assert(readiness.checks.some((check) => check.id === "live_chat" && check.passed), "The readiness gate did not recognize the persisted live shopper conversation");
    if (requireBetaReady) assert(allReadinessChecksPassed, `Production beta gate still has failed checks:\n${readiness.checks.filter((check) => !check.passed).map((check) => `${check.id}: ${check.text}`).join("\n")}`);
    for (const forbidden of ["conversion", "customer acquisition", "revenue lift", "sales lift"]) {
      assert(!readinessText.toLowerCase().includes(forbidden), `Founder readiness includes forbidden metric label: ${forbidden}`);
    }

    await page.addScriptTag({ content: axe.source });
    const audit = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    }));
    assert(audit.violations.length === 0, `Founder platform accessibility violations: ${audit.violations.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 6).map((node) => `${node.target.join(" ")} (${node.failureSummary ?? violation.help})`).join(" | ")}`).join("\n")}`);

    await page.getByRole("button", { name: "العربية" }).click();
    await page.waitForTimeout(5_000);
    const arabicSnapshot = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      cookie: document.cookie.includes("nbeh-dashboard-locale=ar"),
      readiness: document.querySelector('[data-testid="beta-readiness"]')?.textContent ?? "",
    }));
    assert(arabicSnapshot.lang === "ar" && arabicSnapshot.dir === "rtl" && arabicSnapshot.cookie && arabicSnapshot.readiness.includes("جاهزية النسخة التجريبية"), `Arabic dashboard did not settle correctly: ${JSON.stringify(arabicSnapshot)}`);
    assert(successfulEventResponses > 0, "The production demo storefront did not persist any analytics event successfully");
    assert(failures.length === 0, failures.join("\n"));

    console.log(JSON.stringify({
      status: "passed",
      baseUrl,
      health: {
        buildId: healthPayload.buildId,
        dataBackend: healthPayload.dataBackend,
        provider: healthPayload.provider,
        model: healthPayload.model,
        commerceProviders: healthPayload.commerceProviders,
      },
      founderReadiness: allReadinessChecksPassed ? "ready" : "blocked",
      readinessChecks: readiness.checks,
      shopperChatPersisted: true,
      arabicDashboard: true,
      storefrontWidget: true,
      accessibility: true,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
