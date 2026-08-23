import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getAgentHealth } from "@/app/api/agent/health/route";
import { getActiveAgentConfig } from "@/lib/agent/config-repository";
import { handleChat } from "@/lib/agent/chat-service";
import { getDashboardIdentity } from "@/lib/auth/require-user";
import { loadDashboardDatabase } from "@/lib/dashboard/data";
import { loadSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { readGlobalAgentConfig } from "@/lib/agent/global-config";

function selectUnconfiguredSupabase() {
  vi.stubEnv("DATA_BACKEND", "supabase");
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("SUPABASE_AGENT_ENABLED", "false");
  vi.stubEnv("FOUNDER_SESSION_SECRET", "");
  vi.stubEnv("NEXTAUTH_SECRET", "");
}

afterEach(() => vi.unstubAllEnvs());

describe("Supabase-selected runtime fails closed", () => {
  it("does not read the local catalog when Supabase service configuration is missing", async () => {
    selectUnconfiguredSupabase();
    await expect(loadSellerKnowledgeForProduct("atelier-wool-coat")).rejects.toThrow("Supabase catalog persistence is selected");
  });

  it("does not return the default active prompt when Supabase service configuration is missing", async () => {
    selectUnconfiguredSupabase();
    await expect(getActiveAgentConfig("83da73d3-32d4-4f3f-a2db-4bd2ea9f4781")).rejects.toThrow("Supabase agent configuration is selected");
  });

  it("does not return a file or default global prompt when Supabase governance is selected", async () => {
    selectUnconfiguredSupabase();
    await expect(readGlobalAgentConfig()).rejects.toThrow("Supabase global agent governance is selected");
  });

  it("does not grant a local demo owner identity in Supabase mode", async () => {
    selectUnconfiguredSupabase();
    await expect(getDashboardIdentity()).rejects.toThrow("Supabase dashboard authentication is unavailable");
  });

  it("does not return the local dashboard database in Supabase mode", async () => {
    selectUnconfiguredSupabase();
    await expect(loadDashboardDatabase()).rejects.toThrow("Supabase dashboard authentication is unavailable");
  });

  it("does not process chat with the local runtime in Supabase mode", async () => {
    selectUnconfiguredSupabase();
    await expect(handleChat({
      productSlug: "atelier-wool-coat",
      message: "Is it warm?",
      visitorRef: "anon-fail-closed",
    })).rejects.toThrow("Supabase agent persistence is selected");
  });

  it("reports degraded health without claiming persistence, logging, or insights", async () => {
    selectUnconfiguredSupabase();
    const response = await getAgentHealth();
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      status: "degraded",
      dataBackend: "supabase",
      persistenceConfigured: false,
      loggingEnabled: false,
      insightsEnabled: false,
      catalogProvider: "supabase",
    });
  });
});
