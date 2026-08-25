import { randomUUID } from "node:crypto";

const baseUrl = (process.env.PRODUCTION_SMOKE_URL || "https://www.nbeh.io").replace(/\/$/, "");
const expectedGitSha = process.env.EXPECTED_GIT_SHA?.trim() || null;
const runLiveChat = process.env.PRODUCTION_COMMERCE_LIVE_CHAT === "true";
const deploymentTimeoutMs = Number(process.env.PRODUCTION_DEPLOYMENT_TIMEOUT_MS || 15 * 60_000);

const platforms = [
  {
    provider: "salla",
    storeId: process.env.SALLA_SMOKE_STORE_ID || "1583872632",
    productRef: process.env.SALLA_SMOKE_PRODUCT_REF || "674788844",
    origin: process.env.SALLA_SMOKE_ORIGIN || "https://demostore.salla.sa",
    locale: "ar",
    question: "كم سعر هذا المنتج وهل هو متوفر؟",
  },
  {
    provider: "zid",
    storeId: process.env.ZID_SMOKE_STORE_ID || "3220733",
    productRef: process.env.ZID_SMOKE_PRODUCT_REF || "0bf2d15f-b724-42f6-aa72-e15bd2c90a24",
    origin: process.env.ZID_SMOKE_ORIGIN || "https://npx6j8.zid.store",
    locale: "en",
    question: "What is the price and is it in stock?",
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(240_000),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* Non-JSON assets are expected. */ }
  return { response, text, payload };
}

async function waitForExpectedDeployment() {
  const startedAt = Date.now();
  let latest = null;
  while (Date.now() - startedAt < deploymentTimeoutMs) {
    try {
      const result = await request("/api/agent/health");
      latest = result.payload;
      if (result.response.ok && latest?.status === "ok" && (!expectedGitSha || latest.buildId === expectedGitSha)) return latest;
    } catch {
      // Vercel may briefly return no deployment while an alias is moving.
    }
    await sleep(15_000);
  }
  throw new Error(`Production did not become healthy for commit ${expectedGitSha || "current"}. Latest build: ${latest?.buildId || "unavailable"}.`);
}

async function verifyPlatform(platform) {
  const query = new URLSearchParams({ merchantKey: platform.storeId, productRef: platform.productRef });
  const [config, preferences] = await Promise.all([
    request(`/api/widget/config?${query}`, { headers: { Origin: platform.origin } }),
    request(`/api/widget/preferences?merchantKey=${encodeURIComponent(platform.storeId)}`, { headers: { Origin: platform.origin } }),
  ]);

  assert(config.response.ok, `${platform.provider} widget config returned ${config.response.status}.`);
  assert(config.payload?.catalogProvider === platform.provider, `${platform.provider} resolved the wrong catalog provider.`);
  assert(config.payload?.assistant?.name === "Nbeh", `${platform.provider} is not serving the Nbeh assistant.`);
  assert(config.payload?.merchant?.displayName, `${platform.provider} merchant identity is missing.`);
  assert(config.payload?.product?.name, `${platform.provider} product context is missing.`);
  assert(preferences.response.ok, `${platform.provider} widget preferences returned ${preferences.response.status}.`);
  assert(["left", "right"].includes(preferences.payload?.positionAr), `${platform.provider} Arabic widget position is invalid.`);
  assert(["left", "right"].includes(preferences.payload?.positionEn), `${platform.provider} English widget position is invalid.`);

  if (runLiveChat) {
    const chat = await request("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: platform.origin },
      body: JSON.stringify({
        merchantKey: platform.storeId,
        productSlug: platform.productRef,
        message: platform.question,
        visitorRef: `anon-cd-${platform.provider}-${randomUUID().slice(0, 12)}`,
        sessionId: randomUUID(),
        locale: platform.locale,
        conversationHistory: [],
        pageContext: {
          url: `${platform.origin}/product/${platform.productRef}`,
          path: `/product/${platform.productRef}`,
          title: config.payload.product.name,
          productName: config.payload.product.name,
          locale: platform.locale,
        },
      }),
    });
    assert(chat.response.ok, `${platform.provider} live chat returned ${chat.response.status}.`);
    assert(chat.payload?.conversationId, `${platform.provider} live chat did not persist a conversation.`);
    assert(typeof chat.payload?.answer === "string" && chat.payload.answer.trim().length >= 8, `${platform.provider} live chat returned an empty answer.`);
    assert(!chat.payload?.fallbackReason, `${platform.provider} live chat unexpectedly fell back: ${chat.payload?.fallbackReason}.`);
  }

  return {
    provider: platform.provider,
    storeId: platform.storeId,
    merchant: config.payload.merchant.displayName,
    product: config.payload.product.name,
    widgetConfig: "passed",
    preferences: "passed",
    liveChat: runLiveChat ? "passed" : "not_run",
  };
}

async function discoverCurrentZidProductRef(platform) {
  const home = await fetch(platform.origin, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
  assert(home.ok, `Could not load the live Zid storefront (${home.status}).`);
  const homeHtml = await home.text();
  const productPath = homeHtml.match(/href=["']([^"']*\/products\/[^"'#?]+)["']/i)?.[1];
  assert(productPath, "The live Zid storefront did not expose a current product link.");
  const productUrl = new URL(productPath, platform.origin);
  const page = await fetch(productUrl, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
  assert(page.ok, `Could not load a current Zid product page (${page.status}).`);
  const html = await page.text();
  const productRef = html.match(/id=["']product-id["'][\s\S]{0,240}?value=["']([a-zA-Z0-9_-]{1,160})["']/i)?.[1]
    || html.match(/name=["']product_id["'][\s\S]{0,240}?value=["']([a-zA-Z0-9_-]{1,160})["']/i)?.[1];
  assert(productRef, "The current Zid product page did not expose its product identity.");
  return productRef;
}

async function main() {
  const health = await waitForExpectedDeployment();
  assert(health.dataBackend === "supabase", `Production data backend is ${health.dataBackend}.`);
  assert(health.databaseReachable === true, "Production database is unreachable.");
  assert(health.persistenceConfigured === true, "Production persistence is not configured.");
  assert(health.commerceProvidersConfigured === true, "Salla or Zid production configuration is incomplete.");
  assert(health.commerceRuntimeHealthy === true, "A production Salla or Zid connection has lost its catalog runtime.");

  const zid = platforms.find((platform) => platform.provider === "zid");
  if (zid) zid.productRef = await discoverCurrentZidProductRef(zid);

  const [sallaLoader, zidLoader] = await Promise.all([request("/salla-widget.js"), request("/zid-widget.js")]);
  assert(sallaLoader.response.ok && zidLoader.response.ok, "A commerce widget loader is unavailable.");
  assert(sallaLoader.text === zidLoader.text, "Salla and Zid are not serving the same branded widget loader.");

  const results = [];
  for (const platform of platforms) results.push(await verifyPlatform(platform));

  console.log(JSON.stringify({ status: "passed", baseUrl, buildId: health.buildId, liveChat: runLiveChat, platforms: results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
