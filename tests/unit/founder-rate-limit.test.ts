import { beforeEach, describe, expect, it, vi } from "vitest";

const consume = vi.fn();
const verify = vi.fn();
const createSession = vi.fn();

vi.mock("@/lib/backend/mode", () => ({ resolveDataBackend: () => "supabase" }));
vi.mock("@/lib/security/request-fingerprint", () => ({ deriveRequestFingerprint: () => `rfp_v1_${"a".repeat(64)}` }));
vi.mock("@/lib/security/durable-rate-limit", () => ({ consumeDurableRateLimit: consume }));
vi.mock("@/lib/auth/founder-session", () => ({
  createFounderSession: createSession,
  isFounderAuthConfigured: () => true,
  verifyFounderCredentials: verify,
}));

function request() {
  return new Request("https://nbeh.test/api/auth/founder-login", {
    method: "POST",
    headers: { origin: "https://nbeh.test", "content-type": "application/json" },
    body: JSON.stringify({ email: "founder@nbeh.io", password: "wrong" }),
  });
}

describe("Founder login abuse controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consume.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    verify.mockResolvedValue(false);
  });

  it("rejects a blocked request before password verification", async () => {
    consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 137 });
    const response = await (await import("@/app/api/auth/founder-login/route")).POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("137");
    expect(verify).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("fails closed when the durable limiter is unavailable", async () => {
    consume.mockRejectedValue(new Error("database unavailable"));
    const response = await (await import("@/app/api/auth/founder-login/route")).POST(request());
    expect(response.status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
  });
});
