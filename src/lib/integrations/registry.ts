import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getCatalogProvider } from "@/lib/catalog";
import type { PlatformProvider } from "@/lib/types";

export type CommerceProvider = Exclude<PlatformProvider, "demo_catalog">;

interface OAuthEnvironment {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  webhookSecret?: string;
}

export interface ProviderReadiness {
  provider: PlatformProvider;
  displayName: string;
  requiredScopes: string[];
  supportsOAuth: boolean;
  supportsWebhooks: boolean;
  credentialsConfigured: boolean;
  webhookConfigured: boolean;
  approvalRequired: boolean;
  missingEnvironmentVariables: string[];
  documentationUrl: string;
}

export function isCommerceProvider(value: string): value is CommerceProvider {
  return value === "salla" || value === "zid";
}

function providerPrefix(provider: CommerceProvider): "SALLA" | "ZID" {
  return provider === "salla" ? "SALLA" : "ZID";
}

export function providerEnvironment(provider: CommerceProvider): OAuthEnvironment {
  const prefix = providerPrefix(provider);
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`],
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`],
    redirectUri: process.env[`${prefix}_REDIRECT_URI`],
    authorizeUrl: process.env[`${prefix}_AUTHORIZE_URL`] || (provider === "zid" ? "https://oauth.zid.sa/oauth/authorize" : "https://accounts.salla.sa/oauth2/auth"),
    tokenUrl: process.env[`${prefix}_TOKEN_URL`] || (provider === "zid" ? "https://oauth.zid.sa/oauth/token" : "https://accounts.salla.sa/oauth2/token"),
    webhookSecret: process.env[`${prefix}_WEBHOOK_SECRET`],
  };
}

export function getProviderReadiness(provider: PlatformProvider): ProviderReadiness {
  const adapter = getCatalogProvider(provider);
  if (provider === "demo_catalog") {
    return {
      provider,
      displayName: adapter.manifest.displayName,
      requiredScopes: [...adapter.manifest.requiredScopes],
      supportsOAuth: false,
      supportsWebhooks: false,
      credentialsConfigured: true,
      webhookConfigured: false,
      approvalRequired: false,
      missingEnvironmentVariables: [],
      documentationUrl: adapter.manifest.documentationUrl,
    };
  }
  const environment = providerEnvironment(provider);
  // Salla production installs use Easy Mode: tokens arrive in the signed
  // app.store.authorize webhook. A browser redirect URI is not required.
  const required = provider === "salla"
    ? ["clientId", "clientSecret", "tokenUrl"] as const
    : ["clientId", "clientSecret", "redirectUri", "authorizeUrl", "tokenUrl"] as const;
  const missingEnvironmentVariables = required
    .filter((key) => !environment[key])
    .map((key) => `${providerPrefix(provider)}_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);
  return {
    provider,
    displayName: adapter.manifest.displayName,
    requiredScopes: [...adapter.manifest.requiredScopes],
    supportsOAuth: adapter.manifest.supportsOAuth,
    supportsWebhooks: adapter.manifest.supportsWebhooks,
    credentialsConfigured: missingEnvironmentVariables.length === 0,
    webhookConfigured: Boolean(environment.webhookSecret),
    approvalRequired: true,
    missingEnvironmentVariables,
    documentationUrl: adapter.manifest.documentationUrl,
  };
}

export function createOAuthState(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function hashOAuthState(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const supplied = new URL(origin);
    const target = new URL(request.url);
    if (supplied.origin === target.origin) return true;
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return loopbackHosts.has(supplied.hostname)
      && loopbackHosts.has(target.hostname)
      && supplied.protocol === target.protocol
      && supplied.port === target.port;
  } catch {
    return false;
  }
}

export function buildAuthorizationUrl(provider: CommerceProvider, state: string): URL | null {
  const environment = providerEnvironment(provider);
  if (!environment.authorizeUrl || !environment.clientId || !environment.redirectUri) return null;
  const url = new URL(environment.authorizeUrl);
  url.searchParams.set("client_id", environment.clientId);
  url.searchParams.set("redirect_uri", environment.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getCatalogProvider(provider).manifest.requiredScopes.join(" "));
  url.searchParams.set("state", state);
  return url;
}

export function verifyWebhookSignature(provider: CommerceProvider, body: string, suppliedSignature: string | null): boolean {
  const secret = providerEnvironment(provider).webhookSecret;
  if (!secret || !suppliedSignature) return false;
  const rawSupplied = suppliedSignature.trim();
  if (provider === "zid") {
    const suppliedBuffer = Buffer.from(rawSupplied);
    const secretBuffer = Buffer.from(secret);
    if (suppliedBuffer.length === secretBuffer.length && timingSafeEqual(suppliedBuffer, secretBuffer)) return true;
  }
  const supplied = rawSupplied.replace(/^sha256=/i, "").toLowerCase();
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export function verifyZidWebhookAuthorization(authorization: string | null): boolean {
  const secret = providerEnvironment("zid").webhookSecret;
  if (!secret || !authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(authorization.slice(6).trim(), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0 || decoded.slice(0, separator) !== "nbeh") return false;
    const supplied = Buffer.from(decoded.slice(separator + 1));
    const expected = Buffer.from(secret);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}

export function summarizeWebhookPayload(payload: unknown): Record<string, unknown> {
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {};
  return {
    event: String(record.event ?? record.event_name ?? record.type ?? record.action ?? "unknown").slice(0, 120),
    external_event_id: String(record.id ?? record.event_id ?? "").slice(0, 160) || null,
    resource_id: String(data.id ?? record.resource_id ?? "").slice(0, 160) || null,
    received_keys: Object.keys(record).slice(0, 30),
    payload_sha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    pii_minimized: true,
  };
}

export function extractWebhookStoreId(payload: unknown): string | null {
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {};
  const store = record.store && typeof record.store === "object" && !Array.isArray(record.store) ? record.store as Record<string, unknown> : {};
  const candidate = record.store_id ?? record.storeId ?? record.merchant_id ?? record.merchant ?? data.store_id ?? data.storeId ?? store.id;
  if (typeof candidate !== "string" && typeof candidate !== "number") return null;
  const normalized = String(candidate).trim();
  return normalized && normalized.length <= 160 ? normalized : null;
}

export function webhookEventKey(summary: Record<string, unknown>): string {
  const externalId = typeof summary.external_event_id === "string" ? summary.external_event_id.trim() : "";
  if (externalId) return externalId.slice(0, 160);
  const digest = typeof summary.payload_sha256 === "string" ? summary.payload_sha256.trim() : "";
  return `payload-${digest}`.slice(0, 160);
}
