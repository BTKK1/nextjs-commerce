import { expect, test } from "@playwright/test";

test("external embed surfaces expose merchant-scoped non-secret configuration", async ({ page, request }) => {
  const loader = await request.get("/widget.js");
  expect(loader.status()).toBe(200);
  expect(loader.headers()["content-type"]).toContain("application/javascript");
  const loaderText = await loader.text();
  expect(loaderText).toContain("data-merchant-key");
  expect(loaderText).toContain("/embed/widget");
  expect(loaderText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  expect(loaderText).not.toContain("system_prompt");

  const config = await request.get("/api/widget/config?merchantKey=demo-maison-vert&productRef=everyday-leather-tote");
  expect(config.status()).toBe(200);
  const payload = await config.json();
  expect(payload).toMatchObject({ assistant: { name: "Nbeh", arabicName: "نبيه" }, merchant: { publicKey: "demo-maison-vert", displayName: "Maison Vert" }, product: { ref: "everyday-leather-tote" }, catalogProvider: "demo_catalog" });
  expect(JSON.stringify(payload)).not.toContain("systemPrompt");
  expect(JSON.stringify(payload)).not.toContain("developerPrompt");

  const parentOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100").origin;
  await page.goto(`/embed/widget?merchantKey=demo-maison-vert&productRef=everyday-leather-tote&locale=en&parentOrigin=${encodeURIComponent(parentOrigin)}`);
  await expect(page.getByTestId("agent-chat-toggle")).toBeVisible();
  await page.getByTestId("agent-chat-toggle").click();
  await expect(page.getByRole("heading", { name: "Nbeh" })).toBeVisible();
  await expect(page.getByTestId("chat-messages")).toContainText("Everyday Leather Tote");
});

test("invalid tenants and unapproved provider connections fail closed", async ({ request }) => {
  const missingOrigin = await request.get("/embed/widget?merchantKey=demo-maison-vert&productRef=everyday-leather-tote&locale=en");
  expect(missingOrigin.status()).toBe(403);
  expect(missingOrigin.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");

  const forgedOrigin = await request.get("/embed/widget?merchantKey=demo-maison-vert&productRef=everyday-leather-tote&locale=en&parentOrigin=https%3A%2F%2Fattacker.example");
  expect(forgedOrigin.status()).toBe(403);
  expect(forgedOrigin.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");

  const missingMerchant = await request.get("/api/widget/config?merchantKey=missing-merchant&productRef=everyday-leather-tote");
  expect(missingMerchant.status()).toBe(404);

  const oauthGet = await request.get("/api/integrations/salla/oauth/start", { headers: { accept: "application/json" } });
  expect(oauthGet.status()).toBe(405);
  const oauthCrossSite = await request.post("/api/integrations/salla/oauth/start", { headers: { accept: "application/json", origin: "https://attacker.example" } });
  expect(oauthCrossSite.status()).toBe(403);

  const webhook = await request.post("/api/integrations/zid/webhooks", { data: { event: "product.updated" }, headers: { "x-ai-sales-merchant": "demo-maison-vert" } });
  expect(webhook.status()).toBe(401);
});
