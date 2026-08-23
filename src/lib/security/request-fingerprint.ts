import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { resolveDataBackend } from "@/lib/backend/mode";

const FINGERPRINT_VERSION = "rfp_v1";

function firstValidAddress(value: string | null): string | null {
  if (!value) return null;
  for (const candidate of value.split(",")) {
    const address = candidate.trim();
    if (isIP(address)) return address;
  }
  return null;
}

function trustedClientAddress(request: Request): string | null {
  // Vercel overwrites x-forwarded-for and does not forward a caller-supplied
  // value, specifically to prevent spoofing (Vercel Request Headers docs).
  if (process.env.VERCEL === "1") {
    return firstValidAddress(request.headers.get("x-forwarded-for"));
  }

  // Self-hosted deployments must explicitly opt in only when their reverse
  // proxy strips inbound forwarding headers and writes its own trusted value.
  if (process.env.TRUST_PROXY_IP_HEADERS === "true") {
    return firstValidAddress(request.headers.get("x-forwarded-for"))
      ?? firstValidAddress(request.headers.get("x-real-ip"));
  }

  return null;
}

function requiresFingerprint(): boolean {
  return process.env.NODE_ENV === "production" && resolveDataBackend() === "supabase";
}

/**
 * Returns a bounded opaque identifier for abuse controls. Raw client network
 * addresses and forwarding headers never leave this function or reach storage.
 */
export function deriveRequestFingerprint(request: Request): string | undefined {
  const secret = process.env.AGENT_RATE_LIMIT_SECRET;
  const address = trustedClientAddress(request);

  if (!secret || secret.length < 32 || !address) {
    if (requiresFingerprint()) {
      throw new Error("Trusted request fingerprinting is not configured.");
    }
    return undefined;
  }

  const digest = createHmac("sha256", secret)
    .update(`${FINGERPRINT_VERSION}:${address}`)
    .digest("hex");
  return `${FINGERPRINT_VERSION}_${digest}`;
}
