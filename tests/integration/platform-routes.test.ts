import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let serviceClient: unknown;
let dashboardIdentity: Record<string, unknown> | null;
let syncCatalog: ReturnType<typeof vi.fn>;
let replaceCommerceProducts: (...args: unknown[]) => Promise<void>;

vi.mock("@/utils/supabase/server", () => ({
  createServiceClient: () => serviceClient,
  hasSupabaseServiceConfig: () => true,
}));

vi.mock("@/lib/auth/require-user", () => ({
  getDashboardIdentity: () => Promise.resolve(dashboardIdentity),
}));

vi.mock("@/lib/catalog", () => ({
  getCatalogProvider: (provider: string) => ({
    manifest: {
      displayName: provider === "salla" ? "Salla" : provider === "zid" ? "Zid" : "Demo Catalog",
      requiredScopes: ["products.read"],
      supportsOAuth: provider !== "demo_catalog",
      supportsWebhooks: provider !== "demo_catalog",
      documentationUrl: "https://example.invalid/docs",
    },
    syncCatalog,
  }),
}));

vi.mock("@/lib/catalog/supabase-mapper", () => ({
  catalogProductToSupabaseRow: (product: unknown) => product,
}));

vi.mock("@/lib/integrations/catalog-replacement", () => ({
  replaceCommerceProducts: (...args: unknown[]) => replaceCommerceProducts(...args),
}));

function responseBuilder(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const builder: Record<string, unknown> = {
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve(resolved).then(resolve, reject);
    },
  };
  for (const name of ["select", "eq", "insert", "update", "upsert"]) {
    builder[name] = () => builder;
  }
  builder.maybeSingle = () => Promise.resolve(resolved);
  return builder;
}

beforeEach(() => {
  vi.stubEnv("DATA_BACKEND", "supabase");
  dashboardIdentity = {
    userId: "74f0c4a0-0962-4d22-a365-4098ed2939c9",
    email: "owner@nbeh.test",
    merchantId: "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781",
    role: "owner",
    authMode: "supabase",
  };
  syncCatalog = vi.fn();
  replaceCommerceProducts = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("platform integration route boundaries", () => {
  it("opens the Salla Easy Mode installation instead of a broken OAuth callback flow", async () => {
    vi.stubEnv("SALLA_CLIENT_ID", "salla-client-1");
    vi.stubEnv("SALLA_CLIENT_SECRET", "salla-secret-1");
    vi.stubEnv("SALLA_INSTALL_URL", "https://s.salla.sa/apps/install/1132747795");
    serviceClient = { rpc: vi.fn() };
    const { POST } = await import("@/app/api/integrations/[provider]/oauth/start/route");

    const response = await POST(new Request("https://nbeh.test/api/integrations/salla/oauth/start", {
      method: "POST",
      headers: { origin: "https://nbeh.test", accept: "application/json" },
    }), { params: Promise.resolve({ provider: "salla" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authorizationUrl: "https://s.salla.sa/apps/install/1132747795",
      mode: "easy",
    });
    expect((serviceClient as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it("starts Zid OAuth when the marketplace opens the public installation URL", async () => {
    vi.stubEnv("ZID_CLIENT_ID", "zid-client-7450");
    vi.stubEnv("ZID_CLIENT_SECRET", "server-only-zid-secret");
    vi.stubEnv("ZID_REDIRECT_URI", "https://nbeh.test/api/integrations/zid/oauth/callback");
    const { GET } = await import("@/app/api/integrations/[provider]/oauth/start/route");

    const response = await GET(
      new Request("https://nbeh.test/api/integrations/zid/oauth/start"),
      { params: Promise.resolve({ provider: "zid" }) },
    );
    const destination = new URL(response.headers.get("location") ?? "https://invalid.test");

    expect(response.status).toBe(307);
    expect(destination.origin).toBe("https://oauth.zid.sa");
    expect(destination.searchParams.get("client_id")).toBe("zid-client-7450");
    expect(destination.searchParams.get("redirect_uri")).toBe("https://nbeh.test/api/integrations/zid/oauth/callback");
    expect(destination.searchParams.get("scope")).toBe("products.read");
    expect(destination.searchParams.has("state")).toBe(false);
  });

  it("rejects advanced-agent-only roles from integration ownership routes", async () => {
    dashboardIdentity = { ...dashboardIdentity, role: "advanced_admin" };
    const { POST: startOAuth } = await import("@/app/api/integrations/[provider]/oauth/start/route");
    const { POST: syncCatalogRoute } = await import("@/app/api/dashboard/integrations/[provider]/sync/route");
    const request = new Request("https://nbeh.test/api/integrations/salla/oauth/start", {
      method: "POST",
      headers: { origin: "https://nbeh.test" },
    });

    const oauthResponse = await startOAuth(request, { params: Promise.resolve({ provider: "salla" }) });
    const syncResponse = await syncCatalogRoute(new Request("https://nbeh.test/api/dashboard/integrations/salla/sync", {
      method: "POST",
      headers: { origin: "https://nbeh.test" },
    }), { params: Promise.resolve({ provider: "salla" }) });

    expect(oauthResponse.status).toBe(403);
    expect(syncResponse.status).toBe(403);
  });

  it("consumes an OAuth state once and rejects a replay", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: "718c98dc-4765-4294-8302-cdd02571d758", error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    serviceClient = { rpc };
    const { GET } = await import("@/app/api/integrations/[provider]/oauth/callback/route");
    const request = new Request("https://nbeh.test/api/integrations/salla/oauth/callback?state=single-use-state&code=temporary-code");
    const context = { params: Promise.resolve({ provider: "salla" }) };

    const accepted = await GET(request, context);
    const replayed = await GET(request, context);

    expect(accepted.status).toBe(202);
    expect(replayed.status).toBe(400);
    await expect(replayed.json()).resolves.toMatchObject({ error: "OAuth state is invalid or expired" });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1].target_state_hash).toBe(rpc.mock.calls[1][1].target_state_hash);
  });

  it("routes a signed webhook using only the store identity in its body", async () => {
    vi.stubEnv("SALLA_WEBHOOK_SECRET", "test-webhook-secret");
    const rpc = vi.fn().mockResolvedValue({ data: "accepted", error: null });
    serviceClient = { rpc };
    const { POST } = await import("@/app/api/integrations/[provider]/webhooks/route");
    const body = JSON.stringify({ id: "event-1", event: "product.updated", store_id: "signed-store" });
    const signature = createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
    const request = new Request("https://nbeh.test/api/integrations/salla/webhooks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ai-sales-signature": signature,
        "x-merchant-id": "unsigned-attacker-store",
      },
      body,
    });

    const response = await POST(request, { params: Promise.resolve({ provider: "salla" }) });

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith("enqueue_webhook_event_atomic", expect.objectContaining({
      target_external_store_id: "signed-store",
      target_external_event_id: "event-1",
    }));
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain("unsigned-attacker-store");
  });

  it("accepts Salla's official signature header and top-level merchant identity", async () => {
    vi.stubEnv("SALLA_WEBHOOK_SECRET", "test-webhook-secret");
    const rpc = vi.fn().mockResolvedValue({ data: "accepted", error: null });
    serviceClient = { rpc };
    const { POST } = await import("@/app/api/integrations/[provider]/webhooks/route");
    const body = JSON.stringify({ id: "event-salla-1", event: "product.updated", merchant: 8001111210, data: { id: 22 } });
    const signature = createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
    const response = await POST(new Request("https://nbeh.test/api/integrations/salla/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json", "x-salla-signature": signature },
      body,
    }), { params: Promise.resolve({ provider: "salla" }) });

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith("enqueue_webhook_event_atomic", expect.objectContaining({
      target_external_store_id: "8001111210",
      target_event_type: "product.updated",
    }));
  });

  it("acknowledges duplicate webhook delivery without enqueueing it twice", async () => {
    vi.stubEnv("ZID_WEBHOOK_SECRET", "test-zid-secret");
    const rpc = vi.fn().mockResolvedValue({ data: "duplicate", error: null });
    serviceClient = { rpc };
    const { POST } = await import("@/app/api/integrations/[provider]/webhooks/route");
    const body = JSON.stringify({ event_id: "event-replayed", type: "catalog.updated", store: { id: 4401 } });
    const signature = createHmac("sha256", "test-zid-secret").update(body).digest("hex");

    const response = await POST(new Request("https://nbeh.test/api/integrations/zid/webhooks", {
      method: "POST",
      headers: { "x-ai-sales-signature": signature },
      body,
    }), { params: Promise.resolve({ provider: "zid" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accepted: true, duplicate: true });
  });

  it("marks non-catalog webhook deliveries as processed instead of leaving a permanent backlog", async () => {
    vi.stubEnv("SALLA_WEBHOOK_SECRET", "test-webhook-secret");
    const webhookUpdates: Array<Record<string, unknown>> = [];
    serviceClient = {
      rpc: vi.fn().mockResolvedValue({ data: "accepted", error: null }),
      from(table: string) {
        if (table === "platform_integrations") return responseBuilder({ data: { id: "integration-salla-1" } });
        if (table === "webhook_events") {
          const builder = responseBuilder({});
          builder.update = (value: Record<string, unknown>) => {
            webhookUpdates.push(value);
            return builder;
          };
          return builder;
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    };
    const { POST } = await import("@/app/api/integrations/[provider]/webhooks/route");
    const body = JSON.stringify({ id: "event-store-updated", event: "store.updated", merchant: "store-55" });
    const signature = createHmac("sha256", "test-webhook-secret").update(body).digest("hex");

    const response = await POST(new Request("https://nbeh.test/api/integrations/salla/webhooks", {
      method: "POST",
      headers: { "x-salla-signature": signature },
      body,
    }), { params: Promise.resolve({ provider: "salla" }) });

    expect(response.status).toBe(202);
    expect(webhookUpdates).toContainEqual(expect.objectContaining({ status: "processed", error: null }));
  });

  it("revokes Salla credentials and completes the uninstall webhook idempotently", async () => {
    vi.stubEnv("SALLA_WEBHOOK_SECRET", "test-webhook-secret");
    const integrationUpdates: Array<Record<string, unknown>> = [];
    const webhookUpdates: Array<Record<string, unknown>> = [];
    serviceClient = {
      rpc: vi.fn().mockResolvedValue({ data: "accepted", error: null }),
      from(table: string) {
        if (table === "platform_integrations") {
          const builder = responseBuilder({ data: { id: "integration-salla-uninstall" } });
          builder.update = (value: Record<string, unknown>) => {
            integrationUpdates.push(value);
            return builder;
          };
          return builder;
        }
        if (table === "webhook_events") {
          const builder = responseBuilder({});
          builder.update = (value: Record<string, unknown>) => {
            webhookUpdates.push(value);
            return builder;
          };
          return builder;
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    };
    const { POST } = await import("@/app/api/integrations/[provider]/webhooks/route");
    const body = JSON.stringify({ id: "event-salla-uninstall", event: "app.store.uninstall", merchant: "store-77" });
    const signature = createHmac("sha256", "test-webhook-secret").update(body).digest("hex");

    const response = await POST(new Request("https://nbeh.test/api/integrations/salla/webhooks", {
      method: "POST",
      headers: { "x-salla-signature": signature },
      body,
    }), { params: Promise.resolve({ provider: "salla" }) });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: true, uninstalled: true });
    expect(integrationUpdates).toContainEqual(expect.objectContaining({ status: "disabled", encrypted_credential_ref: null }));
    expect(webhookUpdates).toContainEqual(expect.objectContaining({ status: "processed", error: null }));
  });

  it("stores an internal sync failure while returning a sanitized response", async () => {
    const storedUpdates: Array<Record<string, unknown>> = [];
    const rpc = vi.fn().mockResolvedValue({ error: null });
    syncCatalog.mockRejectedValue(new Error("provider token sk-live-private failed upstream"));
    serviceClient = {
      rpc,
      from(table: string) {
        if (table === "platform_integrations") {
          return responseBuilder({ data: {
            id: "3da190c3-ee41-4533-849a-851490a840d0",
            status: "connected",
            external_store_id: "store-44",
            encrypted_credential_ref: "vault://provider/credential",
          } });
        }
        if (table === "sync_jobs") {
          const builder = responseBuilder({});
          builder.update = (value: Record<string, unknown>) => {
            storedUpdates.push(value);
            return builder;
          };
          return builder;
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    };
    const { POST } = await import("@/app/api/dashboard/integrations/[provider]/sync/route");
    const response = await POST(new Request("https://nbeh.test/api/dashboard/integrations/salla/sync", {
      method: "POST",
      headers: { origin: "https://nbeh.test" },
    }), { params: Promise.resolve({ provider: "salla" }) });
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Catalog synchronization failed");
    expect(JSON.stringify(payload)).not.toContain("sk-live-private");
    expect(storedUpdates).toContainEqual(expect.objectContaining({
      status: "failed",
      error: expect.stringContaining("sk-live-private"),
    }));
    expect(rpc).toHaveBeenCalledWith("record_integration_sync_audit", expect.objectContaining({
      target_status: "failed",
      target_error_code: "catalog_sync_failed",
    }));
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain("sk-live-private");
  });

  it("audits a successful sync after durable job and integration updates", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    syncCatalog.mockResolvedValue({ products: [], cursor: "cursor-2", complete: true });
    serviceClient = {
      rpc,
      from(table: string) {
        if (table === "platform_integrations") {
          return responseBuilder({ data: {
            id: "3da190c3-ee41-4533-849a-851490a840d0",
            status: "connected",
            external_store_id: "store-44",
            encrypted_credential_ref: "vault://provider/credential",
          } });
        }
        if (table === "sync_jobs") return responseBuilder({});
        throw new Error(`Unexpected table: ${table}`);
      },
    };
    const { POST } = await import("@/app/api/dashboard/integrations/[provider]/sync/route");
    const response = await POST(new Request("https://nbeh.test/api/dashboard/integrations/salla/sync", {
      method: "POST",
      headers: { origin: "https://nbeh.test" },
    }), { params: Promise.resolve({ provider: "salla" }) });

    expect(response.status).toBe(200);
    expect(replaceCommerceProducts).toHaveBeenCalledWith("83da73d3-32d4-4f3f-a2db-4bd2ea9f4781", "salla", []);
    await expect(response.json()).resolves.toMatchObject({ status: "success", recordsProcessed: 0 });
    expect(rpc).toHaveBeenCalledWith("record_integration_sync_audit", expect.objectContaining({
      target_provider: "salla",
      target_status: "success",
      target_records_processed: 0,
    }));
  });

  it("repairs a recoverable pending connection through the same full sync action", async () => {
    const integrationUpdates: Array<Record<string, unknown>> = [];
    syncCatalog.mockResolvedValue({ products: [{ externalId: "product-1", slug: "salla-product-1" }], cursor: null, complete: true });
    serviceClient = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from(table: string) {
        if (table === "platform_integrations") {
          const builder = responseBuilder({ data: {
            id: "3da190c3-ee41-4533-849a-851490a840d0",
            status: "pending",
            connected_at: null,
            external_store_id: "store-44",
            encrypted_credential_ref: "vault://provider/credential",
          } });
          builder.update = (value: Record<string, unknown>) => {
            integrationUpdates.push(value);
            return builder;
          };
          return builder;
        }
        if (table === "sync_jobs") return responseBuilder({});
        throw new Error(`Unexpected table: ${table}`);
      },
    };
    const { POST } = await import("@/app/api/dashboard/integrations/[provider]/sync/route");
    const response = await POST(new Request("https://nbeh.test/api/dashboard/integrations/salla/sync", {
      method: "POST",
      headers: { origin: "https://nbeh.test" },
    }), { params: Promise.resolve({ provider: "salla" }) });

    expect(response.status).toBe(200);
    expect(replaceCommerceProducts).toHaveBeenCalledWith(
      "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781",
      "salla",
      [expect.objectContaining({ externalId: "product-1" })],
    );
    expect(integrationUpdates).toContainEqual(expect.objectContaining({ status: "connected" }));
  });
});

describe("Supabase global agent governance", () => {
  it("reads the service-only singleton and writes through the atomic audited RPC", async () => {
    vi.stubEnv("DATA_BACKEND", "supabase");
    const row = {
      system_prompt: "Ground every Nbeh answer in known product data and retain all safety policies.",
      developer_prompt: "Keep answers concise.",
      model_provider: "openrouter",
      model_name: "deepseek/deepseek-chat-v3.1",
      updated_at: "2026-08-13T09:00:00.000Z",
      updated_by: "founder@nbeh.io",
    };
    const rpc = vi.fn().mockResolvedValue({ error: null });
    serviceClient = {
      rpc,
      from: (table: string) => {
        expect(table).toBe("platform_agent_config");
        return responseBuilder({ data: row });
      },
    };
    const { readGlobalAgentConfig, writeGlobalAgentConfig } = await import("@/lib/agent/global-config");

    await expect(readGlobalAgentConfig()).resolves.toMatchObject({
      modelProvider: "openrouter",
      modelName: "deepseek/deepseek-chat-v3.1",
      source: "supabase",
    });
    await writeGlobalAgentConfig({
      systemPrompt: row.system_prompt,
      developerPrompt: row.developer_prompt,
      modelProvider: "openrouter",
      modelName: row.model_name,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    });

    expect(rpc).toHaveBeenCalledWith("update_global_agent_config_atomic", expect.objectContaining({
      target_system_prompt: row.system_prompt,
      target_model_name: row.model_name,
      actor_email: "founder@nbeh.io",
    }));
  });

  it("fails closed when the Supabase singleton has not been seeded", async () => {
    vi.stubEnv("DATA_BACKEND", "supabase");
    serviceClient = { from: () => responseBuilder({ data: null }) };
    const { readGlobalAgentConfig } = await import("@/lib/agent/global-config");

    await expect(readGlobalAgentConfig()).rejects.toThrow("has not been seeded in Supabase");
  });
});
