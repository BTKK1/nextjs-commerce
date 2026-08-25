import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalogProvider, listCatalogProviders } from "@/lib/catalog";
import { buildAuthorizationUrl, extractWebhookStoreId, getProviderReadiness, isSameOriginMutation, summarizeWebhookPayload, verifyWebhookSignature, verifyZidWebhookAuthorization, webhookEventKey } from "@/lib/integrations/registry";
import { fetchSallaJson, normalizeSallaStoreProfile } from "@/lib/integrations/salla-client";
import { sealSallaCredentials } from "@/lib/integrations/salla-credentials";
import { openZidCredentials, sealZidCredentials, type ZidCredentials } from "@/lib/integrations/zid-credentials";
import { getSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { createSeedDatabase } from "@/lib/storage/seed";
import { GET as getSallaWidget } from "@/app/salla-widget.js/route";
import { GET as getZidWidget } from "@/app/zid-widget.js/route";

afterEach(() => vi.unstubAllEnvs());

describe("merchant-installable platform foundation", () => {
  it("normalizes Salla Easy Mode OAuth user-info into the connected store profile", () => {
    expect(normalizeSallaStoreProfile({
      data: {
        id: 88,
        email: "owner@example.test",
        merchant: {
          id: 1177638915,
          name: "Nbeh Demo Store",
          domain: "https://demostore.salla.sa/dev-nbeh-demo",
        },
      },
    }, "fallback-store")).toEqual({
      storeId: "1177638915",
      name: "Nbeh Demo Store",
      email: "owner@example.test",
      url: "https://demostore.salla.sa",
      allowedOrigins: ["https://demostore.salla.sa"],
    });
  });

  it("canonicalizes Salla's lowercase Easy Mode bearer token for API requests", async () => {
    vi.stubEnv("INTEGRATION_STATE_SECRET", "test-only-integration-secret");
    const request = vi.fn().mockResolvedValue(Response.json({ data: { id: 1177638915 } }));
    vi.stubGlobal("fetch", request);
    const credentialRef = sealSallaCredentials({
      accessToken: "easy-mode-access-token",
      refreshToken: null,
      expiresAt: null,
      scope: "settings.read products.read",
      tokenType: "bearer",
    });

    await fetchSallaJson(credentialRef, "https://accounts.salla.sa/oauth2/user/info");

    expect(request).toHaveBeenCalledOnce();
    const [, requestInit] = request.mock.calls[0] as [string, RequestInit];
    expect(new Headers(requestInit.headers).get("authorization")).toBe("Bearer easy-mode-access-token");
    vi.unstubAllGlobals();
  });

  it("publishes explicit provider capabilities without pretending Salla or Zid is connected", () => {
    const providers = listCatalogProviders();
    expect(providers.map((provider) => provider.provider)).toEqual(["demo_catalog", "salla", "zid"]);
    expect(getCatalogProvider("demo_catalog").manifest.production).toBe(false);
    expect(getCatalogProvider("salla").manifest.requiredScopes).toEqual(["products.read", "offline_access"]);
    for (const provider of [getCatalogProvider("salla"), getCatalogProvider("zid")]) {
      expect(provider.isConnected).toBe(false);
      expect(provider.manifest.production).toBe(true);
      expect(provider.manifest.supportsOAuth).toBe(true);
      expect(provider.manifest.supportsWebhooks).toBe(true);
      expect(provider.manifest.requiredScopes.length).toBeGreaterThan(0);
    }
  });

  it("keeps OAuth disabled until every approved-app environment value exists", () => {
    for (const key of ["SALLA_CLIENT_ID", "SALLA_CLIENT_SECRET", "SALLA_REDIRECT_URI", "SALLA_AUTHORIZE_URL", "SALLA_TOKEN_URL"]) vi.stubEnv(key, "");
    expect(getProviderReadiness("salla")).toMatchObject({ credentialsConfigured: false, approvalRequired: true });
    expect(buildAuthorizationUrl("salla", "state-token")).toBeNull();

    vi.stubEnv("SALLA_CLIENT_ID", "client-id");
    vi.stubEnv("SALLA_CLIENT_SECRET", "server-secret");
    vi.stubEnv("SALLA_REDIRECT_URI", "https://agent.example/api/integrations/salla/oauth/callback");
    vi.stubEnv("SALLA_AUTHORIZE_URL", "https://accounts.example/authorize");
    vi.stubEnv("SALLA_TOKEN_URL", "https://accounts.example/token");
    const url = buildAuthorizationUrl("salla", "state-token");
    expect(getProviderReadiness("salla").credentialsConfigured).toBe(true);
    expect(url?.origin).toBe("https://accounts.example");
    expect(url?.searchParams.get("state")).toBe("state-token");
    expect(url?.searchParams.get("scope")).toContain("products.read");
  });

  it("verifies webhook HMACs and stores only a PII-minimized summary", () => {
    vi.stubEnv("ZID_WEBHOOK_SECRET", "webhook-secret");
    const body = JSON.stringify({ id: "event-1", event: "product.updated", customer_email: "shopper@example.com", data: { id: "product-7", phone: "0500000000" } });
    const signature = createHmac("sha256", "webhook-secret").update(body).digest("hex");
    expect(verifyWebhookSignature("zid", body, signature)).toBe(true);
    expect(verifyWebhookSignature("zid", `${body}x`, signature)).toBe(false);
    const summary = summarizeWebhookPayload(JSON.parse(body));
    expect(summary).toMatchObject({ event: "product.updated", external_event_id: "event-1", resource_id: "product-7", pii_minimized: true });
    expect(JSON.stringify(summary)).not.toContain("shopper@example.com");
    expect(JSON.stringify(summary)).not.toContain("0500000000");
  });

  it("accepts Zid's configured custom webhook header without weakening Salla HMAC verification", () => {
    vi.stubEnv("ZID_WEBHOOK_SECRET", "zid-custom-header-secret");
    const body = JSON.stringify({ event_name: "product.update", store_id: "zid-store-1" });
    expect(verifyWebhookSignature("zid", body, "zid-custom-header-secret")).toBe(true);
    expect(verifyWebhookSignature("zid", body, "wrong-secret")).toBe(false);
    expect(verifyWebhookSignature("salla", body, "zid-custom-header-secret")).toBe(false);
    const authorization = `Basic ${Buffer.from("nbeh:zid-custom-header-secret").toString("base64")}`;
    expect(verifyZidWebhookAuthorization(authorization)).toBe(true);
    expect(verifyZidWebhookAuthorization(`Basic ${Buffer.from("attacker:zid-custom-header-secret").toString("base64")}`)).toBe(false);
  });

  it("encrypts Zid OAuth tokens at rest and rejects tampered credential envelopes", () => {
    vi.stubEnv("INTEGRATION_STATE_SECRET", "test-only-integration-secret");
    const credentials: ZidCredentials = {
      authorizationToken: "authorization-token",
      managerToken: "manager-token",
      refreshToken: "refresh-token",
      issuedAt: 1_787_303_400_000,
      expiresAt: 1_792_487_400_000,
      scope: "account.read products.read",
      tokenType: "Bearer",
    };
    const encrypted = sealZidCredentials(credentials);

    expect(encrypted).toMatch(/^zid:v1:/);
    expect(encrypted).not.toContain(credentials.authorizationToken);
    expect(encrypted).not.toContain(credentials.managerToken);
    expect(openZidCredentials(encrypted)).toEqual(credentials);
    expect(() => openZidCredentials(`${encrypted.slice(0, -1)}x`)).toThrow();
  });

  it("derives tenant routing only from the signed webhook body and requires same-origin mutations", () => {
    expect(extractWebhookStoreId({ store_id: "store-7", data: { store_id: "ignored" } })).toBe("store-7");
    expect(extractWebhookStoreId({ data: { storeId: 88 } })).toBe("88");
    expect(extractWebhookStoreId({ event: "product.updated" })).toBeNull();
    expect(webhookEventKey({ external_event_id: null, payload_sha256: "abc123" })).toBe("payload-abc123");
    expect(isSameOriginMutation(new Request("https://nbeh.example/api/sync", { headers: { origin: "https://nbeh.example" } }))).toBe(true);
    expect(isSameOriginMutation(new Request("https://nbeh.example/api/sync", { headers: { origin: "https://attacker.example" } }))).toBe(false);
    expect(isSameOriginMutation(new Request("https://nbeh.example/api/sync"))).toBe(false);
    expect(isSameOriginMutation(new Request("http://localhost:3000/api/sync", { headers: { origin: "http://127.0.0.1:3000" } }))).toBe(true);
    expect(isSameOriginMutation(new Request("http://localhost:3000/api/sync", { headers: { origin: "http://127.0.0.1:3001" } }))).toBe(false);
    expect(isSameOriginMutation(new Request("https://nbeh.example/api/sync", { headers: { origin: "http://localhost:3000" } }))).toBe(false);
  });

  it("resolves identical product slugs within the requested merchant boundary", () => {
    const database = createSeedDatabase();
    const sourceProduct = database.products[0];
    database.merchants.push({ id: "merchant-two", publicKey: "merchant-two-key", name: "Second Merchant", arabicName: "التاجر الثاني", industry: "Ecommerce", city: "Riyadh", demoMode: false });
    database.products.push({ ...sourceProduct, id: "merchant-two-product", merchantId: "merchant-two", name: "Second Merchant Product" });
    database.platformIntegrations.push({ id: "merchant-two-demo", merchantId: "merchant-two", provider: "demo_catalog", status: "connected", connectedAt: new Date().toISOString(), notes: "Test provider" });
    expect(getSellerKnowledgeForProduct(sourceProduct.slug, database, 4, "merchant-two-key")?.currentProduct.name).toBe("Second Merchant Product");
    expect(getSellerKnowledgeForProduct(sourceProduct.slug, database, 4, database.merchants[0].publicKey)?.currentProduct.name).toBe(sourceProduct.name);
  });

  it("ships embed, OAuth, webhook, sync, and platform migration surfaces", () => {
    const root = process.cwd();
    for (const path of [
      "src/app/widget.js/route.ts",
      "src/app/embed/widget/page.tsx",
      "src/app/api/widget/config/route.ts",
      "src/app/api/integrations/[provider]/oauth/start/route.ts",
      "src/app/api/integrations/[provider]/oauth/callback/route.ts",
      "src/app/api/integrations/[provider]/webhooks/route.ts",
      "src/app/api/dashboard/integrations/[provider]/sync/route.ts",
      "supabase/migrations/202608030002_platform_foundation.sql",
      "supabase/migrations/202608130003_agent_runtime_hardening.sql",
      "supabase/migrations/202608130004_abuse_controls.sql",
    ]) expect(existsSync(join(root, path)), path).toBe(true);
    const migration = readFileSync(join(root, "supabase/migrations/202608030002_platform_foundation.sql"), "utf8");
    for (const term of ["public_key", "oauth_states", "provider", "external_event_id", "records_processed", "enable row level security"]) expect(migration).toContain(term);
    const runtimeMigration = readFileSync(join(root, "supabase/migrations/202608130003_agent_runtime_hardening.sql"), "utf8");
    for (const term of ["product_slug", "visitor_ref", "storefront_locale", "idx_messages_merchant_sender_created", "publish_prompt_version_atomic", "rollback_prompt_version_atomic", "prepare_oauth_connection_atomic", "consume_oauth_state_atomic", "enqueue_webhook_event_atomic", "integration_oauth_started", "integration_oauth_callback_validated", "integration_webhook_received", "idx_webhook_events_integration_event_unique", "platform_agent_config", "update_global_agent_config_atomic", "record_integration_sync_audit", "revoke insert, update, delete on table public.audit_logs", "revoke insert, update, delete on table public.merchant_users", "revoke insert, update, delete on table public.webhook_events", "revoke insert, update, delete on table public.oauth_states", "security definer", "revoke all on function", "atomic_governance"]) expect(runtimeMigration).toContain(term);
    const abuseMigration = readFileSync(join(root, "supabase/migrations/202608130004_abuse_controls.sql"), "utf8");
    for (const term of ["request_rate_limit_buckets", "bucket_scope", "consume_request_rate_limit", "security definer", "revoke all on table", "revoke all on function", "service_role"]) expect(abuseMigration).toContain(term);
    expect(abuseMigration).not.toMatch(/\b(ip_address|raw_ip|x_forwarded_for)\b/);
    const revalidation = readFileSync(join(root, "src/utils/bagisto/index.ts"), "utf8");
    expect(revalidation).toContain('req.headers.get("x-bagisto-revalidation-secret")');
    expect(revalidation).not.toContain('searchParams.get("secret")');
    expect(revalidation).toContain('status: 401');
    const playground = readFileSync(join(root, "src/app/api/dashboard/agent/playground/route.ts"), "utf8");
    expect(playground.match(/Same-origin request required/g)).toHaveLength(2);
  });

  it("omits an empty conversation id from the first Salla widget message", async () => {
    const response = getSallaWidget();
    const source = await response.text();

    expect(source).toContain("...(conversationId ? { conversationId } : {})");
    expect(source).not.toMatch(/\n\s+conversationId,\n\s+visitorRef/);
  });

  it("uses the same violet Nbeh identity as the Founder demo widget", async () => {
    const source = await getSallaWidget().text();

    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain("#5B2EFF");
    expect(source).toContain("class=\"nbeh-face\"");
    expect(source).toContain("M 42 10 H 78 A 32 32");
    expect(source).toContain("Q60 90 78 76");
    expect(source).toContain('cx="42" cy="52" r="9"');
    expect(source).not.toContain("translate(34.2 34.2) scale(.43)");
    expect(source).toContain('font-family:"Outfit"');
    expect(source).toContain("Your in-store sales assistant for {product}");
    expect(source).toContain("Nbeh is checking the product details");
    expect(source).toContain('class="teaser"');
    expect(source).toContain("preferences.teaserMessageAr");
    expect(source).toContain("Powered by Nbeh");
    expect(source).toContain('poweredBy.href = origin + "/"');
    expect(source).toContain("scheduleAutoPopup();");
    expect(source).not.toContain('sessionStorage.getItem("nbeh:salla:auto-popup:');
    expect(source).toContain('class="brand-mark"');
    expect(source).toContain('caret.className = "type-caret"');
    expect(source).toContain('class="send-label"');
    expect(source).toContain("send.disabled = input.disabled || !input.value.trim()");
    expect(source).toContain("sessionStorage.setItem(contextStorageKey()");
    expect(source).not.toContain("#173c3a");
    expect(source).not.toContain("#e2b65e");
  });

  it("serves the exact shared branded widget loader for Zid", async () => {
    const [sallaSource, zidSource] = await Promise.all([
      getSallaWidget().text(),
      getZidWidget().text(),
    ]);

    expect(zidSource).toBe(sallaSource);
  });

  it("loads generated style preferences and refuses to mount outside product pages", async () => {
    const source = await getSallaWidget().text();

    expect(source).toContain("/api/widget/preferences?merchantKey=");
    expect(source).toContain("autoPopupDelaySeconds");
    expect(source).toContain("positionAr");
    expect(source).toContain("tonePreset");
    expect(source).toContain("arabicDialect");
    expect(source).toContain("isProductPage");
    expect(source).toContain("if (document.getElementById(HOST_ID) || !isProductPage()) return");
    expect(source).toContain("/api/widget/config?merchantKey=");
    expect(source).toContain("canonicalProductName");
    expect(source).toContain("displayedProductName()");
    expect(source).not.toContain('salla-product-card[product-id]');
    expect(source).not.toContain("onboardingMessageEn");
  });
});
