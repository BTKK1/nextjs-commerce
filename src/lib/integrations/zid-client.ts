import "server-only";
import { openZidCredentials, sealZidCredentials, type ZidCredentials } from "@/lib/integrations/zid-credentials";
import { providerEnvironment } from "@/lib/integrations/registry";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function expiresAt(value: unknown, issuedAt: number): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  // Zid documents expires_in as a duration, but tolerate an epoch value too.
  return numeric > 10_000_000_000 ? numeric : numeric > 1_000_000_000 ? numeric * 1000 : issuedAt + numeric * 1000;
}

function tokenPayload(payload: unknown): ZidCredentials {
  const data = record(payload);
  const issuedAt = Date.now();
  const authorizationToken = text(data.authorization).replace(/^Bearer\s+/i, "");
  const managerToken = text(data.access_token);
  if (!authorizationToken || !managerToken) throw new Error("Zid token exchange did not return both required tokens.");
  return {
    authorizationToken,
    managerToken,
    refreshToken: text(data.refresh_token) || null,
    issuedAt,
    expiresAt: expiresAt(data.expires_in, issuedAt),
    scope: text(data.scope),
    tokenType: text(data.token_type) || "Bearer",
  };
}

async function tokenRequest(body: URLSearchParams): Promise<ZidCredentials> {
  const environment = providerEnvironment("zid");
  if (!environment.tokenUrl || !environment.clientId || !environment.clientSecret || !environment.redirectUri) {
    throw new Error("Zid OAuth credentials are not configured.");
  }
  const response = await fetch(environment.tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Zid OAuth token request failed with status ${response.status}.`);
  return tokenPayload(await response.json());
}

export async function exchangeZidAuthorizationCode(code: string): Promise<ZidCredentials> {
  const environment = providerEnvironment("zid");
  return tokenRequest(new URLSearchParams({
    grant_type: "authorization_code",
    client_id: environment.clientId ?? "",
    client_secret: environment.clientSecret ?? "",
    redirect_uri: environment.redirectUri ?? "",
    code,
  }));
}

export async function refreshZidCredentials(credentials: ZidCredentials): Promise<ZidCredentials> {
  if (!credentials.refreshToken) throw new Error("The Zid installation requires reauthorization.");
  const environment = providerEnvironment("zid");
  return tokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: credentials.refreshToken,
    client_id: environment.clientId ?? "",
    client_secret: environment.clientSecret ?? "",
    redirect_uri: environment.redirectUri ?? "",
  }));
}

export async function currentZidCredentials(
  credentialRef: string | null | undefined,
  persistCredentialRef?: (credentialRef: string) => Promise<void>,
): Promise<ZidCredentials> {
  const credentials = openZidCredentials(credentialRef);
  const refreshWithinMs = 5 * 60 * 1000;
  if (!credentials.expiresAt || credentials.expiresAt > Date.now() + refreshWithinMs) return credentials;
  const refreshed = await refreshZidCredentials(credentials);
  if (persistCredentialRef) await persistCredentialRef(sealZidCredentials(refreshed));
  return refreshed;
}

export async function fetchZidJson(
  credentials: ZidCredentials,
  storeId: string | null | undefined,
  endpoint: string | URL,
  init: RequestInit = {},
  persistCredentialRef?: (credentialRef: string) => Promise<void>,
): Promise<unknown> {
  if (!storeId) throw new Error("A Zid store ID is required for every merchant API request.");
  const url = endpoint instanceof URL ? endpoint : new URL(endpoint, "https://api.zid.sa");
  let attempt = 0;
  let activeCredentials = credentials;
  let refreshedAfterUnauthorized = false;
  while (attempt < 4) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Accept-Language": "all-languages",
        Authorization: `Bearer ${activeCredentials.authorizationToken}`,
        "X-Manager-Token": activeCredentials.managerToken,
        "Access-Token": activeCredentials.managerToken,
        "Store-Id": storeId,
        Role: "Manager",
        ...init.headers,
      },
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
    if (response.ok) return response.json();
    if (response.status === 401 && !refreshedAfterUnauthorized && activeCredentials.refreshToken) {
      activeCredentials = await refreshZidCredentials(activeCredentials);
      if (persistCredentialRef) await persistCredentialRef(sealZidCredentials(activeCredentials));
      refreshedAfterUnauthorized = true;
      continue;
    }
    if (![429, 500, 503].includes(response.status) || attempt === 3) {
      throw new Error(`Zid API request failed with status ${response.status}.`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 15_000)
      : Math.min(750 * (2 ** attempt) + Math.floor(Math.random() * 300), 8_000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    attempt += 1;
  }
  throw new Error("Zid API request retry budget was exhausted.");
}

export interface ZidStoreProfile {
  storeId: string;
  storeUuid: string | null;
  name: string;
  email: string | null;
  url: string | null;
}

export function normalizeZidStoreProfile(payload: unknown): ZidStoreProfile {
  const root = record(payload);
  const user = record(root.user ?? record(root.data).user);
  const store = record(user.store ?? record(root.data).store ?? root.store);
  const storeId = text(store.id ?? store.uuid);
  if (!storeId) throw new Error("Zid manager profile did not include a store identity.");
  return {
    storeId,
    storeUuid: text(store.uuid) || null,
    name: text(store.title ?? store.name) || `Zid Store ${storeId}`,
    email: text(store.email ?? user.email) || null,
    url: text(store.url) || null,
  };
}

export async function getZidStoreProfile(credentials: ZidCredentials): Promise<ZidStoreProfile> {
  const response = await fetch("https://api.zid.sa/v1/managers/account/profile", {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      Authorization: `Bearer ${credentials.authorizationToken}`,
      "X-Manager-Token": credentials.managerToken,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Zid store identity request failed with status ${response.status}.`);
  return normalizeZidStoreProfile(await response.json());
}

const PRODUCT_WEBHOOK_EVENTS = ["product.create", "product.update", "product.publish", "product.delete"] as const;

function zidWebhookTarget(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || providerEnvironment("zid").redirectUri;
  if (!configured) throw new Error("The public Nbeh application URL is not configured.");
  return new URL("/api/integrations/zid/webhooks", configured).toString();
}

export async function ensureZidProductWebhooks(credentials: ZidCredentials, storeId: string): Promise<void> {
  const environment = providerEnvironment("zid");
  if (!environment.clientId || !environment.webhookSecret) {
    throw new Error("Zid webhook registration is not configured.");
  }
  const targetUrl = zidWebhookTarget();
  const payload = record(await fetchZidJson(credentials, storeId, "/v1/managers/webhooks"));
  const existing = array(payload.data ?? payload.results ?? payload.webhooks)
    .map(record)
    .filter((item) => text(item.target_url) === targetUrl);

  for (const event of PRODUCT_WEBHOOK_EVENTS) {
    if (existing.some((item) => text(item.event) === event && item.active !== false)) continue;
    await fetchZidJson(credentials, storeId, "/v1/managers/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        target_url: targetUrl,
        original_id: environment.clientId,
        username: "nbeh",
        password: environment.webhookSecret,
      }),
    });
  }
}
