import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  buildFrameAncestorsDirective,
  evaluateWidgetOriginPolicy,
  normalizeAllowedWidgetOrigins,
  normalizeHttpOrigin,
} from "@/lib/widget/origin-policy";
import { proxy } from "@/proxy";

describe("widget embed origin policy", () => {
  it("normalizes exact HTTP(S) origins and rejects URL-shaped lookalikes", () => {
    expect(normalizeHttpOrigin("HTTPS://Example.COM:443")).toBe("https://example.com");
    expect(normalizeHttpOrigin("http://LOCALHOST:3000")).toBe("http://localhost:3000");
    expect(normalizeHttpOrigin("https://example.com/path")).toBeNull();
    expect(normalizeHttpOrigin("https://example.com?origin=other")).toBeNull();
    expect(normalizeHttpOrigin("https://user@example.com")).toBeNull();
    expect(normalizeHttpOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpOrigin(" https://example.com")).toBeNull();
  });

  it("fails a whole configured allowlist closed when any entry is malformed", () => {
    expect(normalizeAllowedWidgetOrigins(["https://shop.example", "http://localhost:3000"])).toEqual([
      "https://shop.example",
      "http://localhost:3000",
    ]);
    expect(normalizeAllowedWidgetOrigins(["https://shop.example", "*.example.com"])).toBeNull();
    expect(normalizeAllowedWidgetOrigins("https://shop.example")).toBeNull();
    expect(normalizeAllowedWidgetOrigins(Array.from({ length: 33 }, (_, index) => `https://shop-${index}.example`))).toBeNull();
  });

  it("allows only the local merchant's exact configured parent origin", async () => {
    const allowed = await evaluateWidgetOriginPolicy("demo-maison-vert", "HTTPS://NBEH-AI.VERCEL.APP:443", {
      env: { DATA_BACKEND: "local" },
    });
    expect(allowed).toMatchObject({ allowed: true, parentOrigin: "https://nbeh-ai.vercel.app", reason: "allowed" });
    expect(buildFrameAncestorsDirective(allowed.allowedOrigins)).toContain("frame-ancestors https://nbeh-ai.vercel.app");

    await expect(evaluateWidgetOriginPolicy("demo-maison-vert", "https://nbeh-ai.vercel.app.evil.test", {
      env: { DATA_BACKEND: "local" },
    })).resolves.toMatchObject({ allowed: false, reason: "origin_not_allowed" });
  });

  it.each([
    [null, "https://nbeh-ai.vercel.app", "invalid_merchant_key"],
    ["demo-maison-vert", null, "missing_parent_origin"],
    ["demo-maison-vert", "not-an-origin", "invalid_parent_origin"],
    ["unknown-merchant", "https://nbeh-ai.vercel.app", "merchant_not_found"],
  ])("fails closed for missing, malformed, or unknown input", async (merchantKey, parentOrigin, reason) => {
    await expect(evaluateWidgetOriginPolicy(merchantKey, parentOrigin, {
      env: { DATA_BACKEND: "local" },
    })).resolves.toMatchObject({ allowed: false, reason });
  });

  it("loads the active merchant allowlist from Supabase by public key without exposing it in the URL", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
      expect(requestUrl.origin).toBe("https://project.supabase.co");
      expect(requestUrl.searchParams.get("public_key")).toBe("eq.merchant_public_key");
      expect(requestUrl.searchParams.get("status")).toBe("eq.active");
      expect(requestUrl.toString()).not.toContain("server-only-secret");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer server-only-secret");
      return new Response(JSON.stringify({
        allowed_widget_origins: ["https://shop.example", "http://localhost:3000"],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await evaluateWidgetOriginPolicy("merchant_public_key", "https://shop.example", {
      env: {
        DATA_BACKEND: "supabase",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-only-secret",
      },
      fetchImpl,
    });

    expect(result).toMatchObject({ allowed: true, reason: "allowed" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("resolves a short Zid store ID to its merchant origin policy", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
      if (requestUrl.pathname.endsWith("/merchants") && requestUrl.searchParams.has("public_key")) {
        return new Response("null", { status: 406 });
      }
      if (requestUrl.pathname.endsWith("/platform_integrations")) {
        expect(requestUrl.searchParams.get("external_store_id")).toBe("eq.3220733");
        expect(requestUrl.searchParams.get("status")).toBe("eq.connected");
        return Response.json({ merchant_id: "merchant-zid-1" });
      }
      expect(requestUrl.searchParams.get("id")).toBe("eq.merchant-zid-1");
      return Response.json({ allowed_widget_origins: ["https://zid-store.example"] });
    }) as unknown as typeof fetch;

    await expect(evaluateWidgetOriginPolicy("3220733", "https://zid-store.example", {
      env: {
        DATA_BACKEND: "supabase",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-only-secret",
      },
      fetchImpl,
    })).resolves.toMatchObject({ allowed: true, reason: "allowed" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("fails closed when Supabase is unavailable, misconfigured, or returns a malformed policy", async () => {
    const unavailableFetch = vi.fn(async () => new Response("unavailable", { status: 503 })) as unknown as typeof fetch;
    await expect(evaluateWidgetOriginPolicy("merchant_public_key", "https://shop.example", {
      env: { DATA_BACKEND: "supabase", SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" },
      fetchImpl: unavailableFetch,
    })).resolves.toMatchObject({ allowed: false, reason: "policy_unavailable" });

    await expect(evaluateWidgetOriginPolicy("merchant_public_key", "https://shop.example", {
      env: { DATA_BACKEND: "supabase" },
    })).resolves.toMatchObject({ allowed: false, reason: "policy_unavailable" });

    const malformedFetch = vi.fn(async () => new Response(JSON.stringify({ allowed_widget_origins: ["https://shop.example/path"] }), { status: 200 })) as unknown as typeof fetch;
    await expect(evaluateWidgetOriginPolicy("merchant_public_key", "https://shop.example", {
      env: { DATA_BACKEND: "supabase", SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" },
      fetchImpl: malformedFetch,
    })).resolves.toMatchObject({ allowed: false, reason: "policy_unavailable" });
  });

  it("uses a deny-all framing directive for every rejection", () => {
    expect(buildFrameAncestorsDirective([])).toBe("frame-ancestors 'none'");
  });

  it("enforces the policy in proxy responses and emits browser-enforced frame ancestors", async () => {
    const allowedUrl = new URL("http://nbeh.test/embed/widget");
    allowedUrl.searchParams.set("merchantKey", "demo-maison-vert");
    allowedUrl.searchParams.set("productRef", "everyday-leather-tote");
    allowedUrl.searchParams.set("parentOrigin", "https://nbeh-ai.vercel.app");
    const allowed = await proxy(new NextRequest(allowedUrl));
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("content-security-policy")).toContain("frame-ancestors https://nbeh-ai.vercel.app");
    expect(allowed.headers.get("x-middleware-next")).toBe("1");

    const deniedUrl = new URL(allowedUrl);
    deniedUrl.searchParams.set("parentOrigin", "https://attacker.example");
    const denied = await proxy(new NextRequest(deniedUrl));
    expect(denied.status).toBe(403);
    expect(denied.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    expect(denied.headers.get("cache-control")).toBe("private, no-store");
    expect(denied.headers.get("x-frame-options")).toBe("DENY");

    deniedUrl.searchParams.delete("parentOrigin");
    const missing = await proxy(new NextRequest(deniedUrl));
    expect(missing.status).toBe(403);
    expect(missing.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
  });
});
