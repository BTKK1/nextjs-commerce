import { afterEach, describe, expect, it } from "vitest";
import { deriveRequestFingerprint } from "@/lib/security/request-fingerprint";

const original = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  DATA_BACKEND: process.env.DATA_BACKEND,
  AGENT_RATE_LIMIT_SECRET: process.env.AGENT_RATE_LIMIT_SECRET,
  TRUST_PROXY_IP_HEADERS: process.env.TRUST_PROXY_IP_HEADERS,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("privacy-preserving request fingerprints", () => {
  it("uses Vercel's overwritten forwarding header and never exposes the address", () => {
    process.env.VERCEL = "1";
    process.env.AGENT_RATE_LIMIT_SECRET = "a-production-secret-that-is-at-least-32-characters";
    const first = deriveRequestFingerprint(new Request("https://nbeh.io/api/agent/chat", { headers: { "x-forwarded-for": "203.0.113.9" } }));
    const rotatedVisitor = deriveRequestFingerprint(new Request("https://nbeh.io/api/agent/chat", { headers: { "x-forwarded-for": "203.0.113.9" } }));
    expect(first).toBe(rotatedVisitor);
    expect(first).toMatch(/^rfp_v1_[0-9a-f]{64}$/);
    expect(first).not.toContain("203.0.113.9");
  });

  it("ignores spoofable forwarding headers outside an explicitly trusted proxy", () => {
    delete process.env.VERCEL;
    delete process.env.TRUST_PROXY_IP_HEADERS;
    process.env.DATA_BACKEND = "local";
    process.env.AGENT_RATE_LIMIT_SECRET = "a-production-secret-that-is-at-least-32-characters";
    expect(deriveRequestFingerprint(new Request("http://localhost/api/agent/chat", { headers: { "x-forwarded-for": "203.0.113.9" } }))).toBeUndefined();
  });

  it("fails closed in production Supabase mode when trusted fingerprinting is unavailable", () => {
    delete process.env.VERCEL;
    delete process.env.TRUST_PROXY_IP_HEADERS;
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.DATA_BACKEND = "supabase";
    process.env.AGENT_RATE_LIMIT_SECRET = "a-production-secret-that-is-at-least-32-characters";
    expect(() => deriveRequestFingerprint(new Request("https://nbeh.io/api/agent/chat"))).toThrow("fingerprinting is not configured");
  });
});
