import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/founder-session", () => ({
  createFounderSession: vi.fn(),
  clearFounderSession: vi.fn(),
  isFounderAuthConfigured: () => true,
  verifyFounderCredentials: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { signOut: vi.fn() } }),
}));

vi.mock("@/lib/backend/mode", () => ({
  resolveDataBackend: () => "local",
}));

afterEach(() => vi.clearAllMocks());

describe("same-origin authentication mutations", () => {
  it("rejects cross-site founder login before credential handling", async () => {
    const { POST } = await import("@/app/api/auth/founder-login/route");
    const response = await POST(new Request("https://nbeh.test/api/auth/founder-login", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ email: "founder@nbeh.io", password: "not-inspected" }),
    }));
    expect(response.status).toBe(403);
  });

  it("rejects cross-site logout without clearing either session", async () => {
    const founderSession = await import("@/lib/auth/founder-session");
    const supabase = await import("@/utils/supabase/server");
    const response = await (await import("@/app/api/auth/merchant-logout/route")).POST(new Request("https://nbeh.test/api/auth/merchant-logout", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }));
    expect(response.status).toBe(403);
    expect(founderSession.clearFounderSession).not.toHaveBeenCalled();
    expect(supabase.createClient).not.toHaveBeenCalled();
  });
});
