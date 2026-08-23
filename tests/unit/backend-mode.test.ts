import { describe, expect, it } from "vitest";
import { resolveDataBackend } from "@/lib/backend/mode";

describe("data backend selection", () => {
  it("honors an explicit local backend", () => {
    expect(resolveDataBackend({ DATA_BACKEND: "local", SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" })).toBe("local");
  });

  it("honors an explicit Supabase backend", () => {
    expect(resolveDataBackend({ DATA_BACKEND: "supabase" })).toBe("supabase");
  });

  it("defaults to Supabase only when server credentials exist", () => {
    expect(resolveDataBackend({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" })).toBe("supabase");
    expect(resolveDataBackend({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toBe("local");
  });

  it("fails closed toward Supabase in production instead of silently enabling local data", () => {
    expect(resolveDataBackend({ NODE_ENV: "production" })).toBe("supabase");
    expect(resolveDataBackend({ VERCEL_ENV: "production" })).toBe("supabase");
  });
});
