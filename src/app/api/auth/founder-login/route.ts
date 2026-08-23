import { NextResponse } from "next/server";
import { createFounderSession, isFounderAuthConfigured, verifyFounderCredentials } from "@/lib/auth/founder-session";
import { isSameOriginMutation } from "@/lib/integrations/registry";
import { resolveDataBackend } from "@/lib/backend/mode";
import { DEMO_MERCHANT_ID } from "@/lib/supabase/constants";
import { consumeDurableRateLimit } from "@/lib/security/durable-rate-limit";
import { deriveRequestFingerprint } from "@/lib/security/request-fingerprint";

function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
  if (!isFounderAuthConfigured()) return NextResponse.json({ error: "Founder access is not configured." }, { status: 503 });
  let fingerprint: string | undefined;
  try {
    fingerprint = deriveRequestFingerprint(request);
  } catch {
    return NextResponse.json({ error: "Founder sign-in is temporarily unavailable." }, { status: 503 });
  }
  if (resolveDataBackend() === "supabase") {
    if (!fingerprint) return NextResponse.json({ error: "Founder sign-in is temporarily unavailable." }, { status: 503 });
    try {
      const limit = await consumeDurableRateLimit({ merchantId: DEMO_MERCHANT_ID, scope: "founder_login", fingerprint, limit: 8, windowSeconds: 900 });
      if (!limit.allowed) {
        return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, {
          status: 429,
          headers: { "Retry-After": String(Math.max(1, limit.retryAfterSeconds)), "Cache-Control": "no-store" },
        });
      }
    } catch {
      return NextResponse.json({ error: "Founder sign-in is temporarily unavailable." }, { status: 503 });
    }
  }
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown; next?: unknown } | null;
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (!(await verifyFounderCredentials(body.email, body.password))) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  await createFounderSession();
  return NextResponse.json({ ok: true, next: safeNext(body.next) }, { headers: { "Cache-Control": "no-store" } });
}
