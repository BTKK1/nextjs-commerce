import "server-only";
import { openSallaCredentials, sealSallaCredentials, type SallaCredentials } from "@/lib/integrations/salla-credentials";
import { providerEnvironment } from "@/lib/integrations/registry";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function safeSallaError(payload: unknown): string {
  const root = record(payload);
  const error = record(root.error);
  const message = text(error.message ?? root.error_description ?? root.message);
  return message ? message.replace(/[\r\n]+/g, " ").slice(0, 240) : "unknown_error";
}

export function normalizeSallaExpiry(value: unknown, issuedAt = Date.now()): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (numeric > 10_000_000_000) return numeric;
  if (numeric > 1_000_000_000) return numeric * 1000;
  return issuedAt + numeric * 1000;
}

function tokenPayload(payload: unknown, previous?: SallaCredentials): SallaCredentials {
  const root = record(payload);
  const data = Object.keys(record(root.data)).length ? record(root.data) : root;
  const issuedAt = Date.now();
  const accessToken = text(data.access_token);
  if (!accessToken) throw new Error("Salla token refresh did not return an access token.");
  return {
    accessToken,
    refreshToken: text(data.refresh_token) || previous?.refreshToken || null,
    issuedAt,
    expiresAt: normalizeSallaExpiry(data.expires_in ?? data.expires, issuedAt),
    scope: text(data.scope) || previous?.scope || "",
    tokenType: text(data.token_type) || previous?.tokenType || "Bearer",
  };
}

export async function refreshSallaCredentials(credentials: SallaCredentials): Promise<SallaCredentials> {
  if (!credentials.refreshToken) throw new Error("The Salla installation requires reauthorization.");
  const environment = providerEnvironment("salla");
  if (!environment.clientId || !environment.clientSecret || !environment.tokenUrl) {
    throw new Error("Salla OAuth refresh credentials are not configured.");
  }
  const response = await fetch(environment.tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
      client_id: environment.clientId,
      client_secret: environment.clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Salla token refresh failed with status ${response.status} (${safeSallaError(payload)}).`);
  }
  return tokenPayload(payload, credentials);
}

function expiryInMilliseconds(credentials: SallaCredentials): number | null {
  const value = Number(credentials.expiresAt);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value > 10_000_000_000) return value;
  if (value > 1_000_000_000) return value * 1000;
  // Legacy installs stored expires_in directly. Treat those references as
  // expired so the refresh token repairs them on the next catalog request.
  return 0;
}

async function persistCredentials(
  credentials: SallaCredentials,
  persistCredentialRef?: (credentialRef: string) => Promise<void>,
): Promise<void> {
  if (persistCredentialRef) await persistCredentialRef(sealSallaCredentials(credentials));
}

export async function currentSallaCredentials(
  credentialRef: string | null | undefined,
  persistCredentialRef?: (credentialRef: string) => Promise<void>,
): Promise<SallaCredentials> {
  const credentials = openSallaCredentials(credentialRef);
  const expiresAt = expiryInMilliseconds(credentials);
  if (expiresAt == null || expiresAt > Date.now() + 5 * 60_000) return credentials;
  const refreshed = await refreshSallaCredentials(credentials);
  await persistCredentials(refreshed, persistCredentialRef);
  return refreshed;
}

export async function fetchSallaJson(
  credentialRef: string | null | undefined,
  endpoint: string | URL,
  init: RequestInit = {},
  persistCredentialRef?: (credentialRef: string) => Promise<void>,
): Promise<unknown> {
  let credentials = await currentSallaCredentials(credentialRef, persistCredentialRef);
  const url = endpoint instanceof URL ? endpoint : new URL(endpoint, "https://api.salla.dev");
  let refreshedAfterUnauthorized = false;
  let lastError = "unknown_error";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        // Salla's Easy Mode payload documents token_type as lowercase
        // "bearer", but its Merchant API expects the canonical scheme.
        Authorization: `Bearer ${credentials.accessToken}`,
        ...init.headers,
      },
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
    if (response.ok) return response.json();
    const errorPayload = await response.json().catch(() => ({}));
    lastError = safeSallaError(errorPayload);
    if (response.status === 401 && !refreshedAfterUnauthorized && credentials.refreshToken) {
      credentials = await refreshSallaCredentials(credentials);
      await persistCredentials(credentials, persistCredentialRef);
      refreshedAfterUnauthorized = true;
      continue;
    }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
      throw new Error(`Salla API request failed with status ${response.status} (${lastError}).`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 15_000)
      : Math.min(750 * (2 ** attempt) + Math.floor(Math.random() * 300), 8_000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  throw new Error(`Salla API request retry budget was exhausted (${lastError}).`);
}

export interface SallaStoreProfile {
  storeId: string;
  name: string;
  email: string | null;
  url: string | null;
  allowedOrigins: string[];
}

function normalizeOrigin(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function normalizeSallaStoreProfile(payload: unknown, fallbackStoreId: string): SallaStoreProfile {
  const root = record(payload);
  const data = Object.keys(record(root.data)).length ? record(root.data) : root;
  const store = Object.keys(record(data.store)).length
    ? record(data.store)
    : Object.keys(record(data.merchant)).length
      ? record(data.merchant)
      : data;
  const domain = record(store.domain);
  const origins = [
    store.url,
    store.store_url,
    store.website,
    store.domain,
    domain.url,
    domain.host,
    store.custom_domain,
  ].map(normalizeOrigin).filter((item): item is string => Boolean(item));
  return {
    storeId: text(store.id ?? store.merchant_id) || fallbackStoreId,
    name: text(store.name ?? store.title) || `Salla Store ${fallbackStoreId}`,
    email: text(store.email ?? record(store.contacts).email ?? data.email) || null,
    url: origins[0] || null,
    allowedOrigins: [...new Set(origins)].slice(0, 8),
  };
}

export async function getSallaStoreProfile(
  credentialRef: string,
  fallbackStoreId: string,
  persistCredentialRef?: (credentialRef: string) => Promise<void>,
): Promise<SallaStoreProfile> {
  // Salla documents the OAuth user-info endpoint as the canonical way to
  // resolve the merchant immediately after an Easy Mode authorization event.
  // It is available before the installation has finished activating every
  // Admin API surface, while still binding the token to its merchant.
  const payload = await fetchSallaJson(
    credentialRef,
    "https://accounts.salla.sa/oauth2/user/info",
    {},
    persistCredentialRef,
  );
  return normalizeSallaStoreProfile(payload, fallbackStoreId);
}
