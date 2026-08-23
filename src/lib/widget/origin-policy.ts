import catalog from "@/data/demo-catalog.json";
import { WIDGET_MERCHANT_KEY_PATTERN } from "@/lib/widget/identity";
import { SERVING_COMMERCE_INTEGRATION_STATUSES } from "@/lib/integrations/serving-status";

export const EMBED_WIDGET_PATH = "/embed/widget";

const DEFAULT_PORTS: Readonly<Record<string, string>> = {
  "http:": "80",
  "https:": "443",
};

type WidgetOriginPolicyEnvironment = {
  DATA_BACKEND?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  [key: string]: string | undefined;
};

type SupabaseMerchantPolicyRow = {
  allowed_widget_origins?: unknown;
};

type SupabasePolicyResponse = {
  allowed_widget_origins?: unknown;
};

type SupabaseIntegrationPolicyResponse = {
  merchant_id?: unknown;
};

export type WidgetOriginPolicy = {
  allowed: boolean;
  allowedOrigins: string[];
  parentOrigin: string | null;
  reason: "allowed" | "invalid_merchant_key" | "missing_parent_origin" | "invalid_parent_origin" | "merchant_not_found" | "origin_not_allowed" | "policy_unavailable";
};

export type WidgetOriginPolicyOptions = {
  env?: WidgetOriginPolicyEnvironment;
  fetchImpl?: typeof fetch;
};

export function normalizeHttpOrigin(value: string | null | undefined): string | null {
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return null;
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;

  const explicitPort = parsed.port;
  const defaultPort = DEFAULT_PORTS[parsed.protocol];
  const port = explicitPort && explicitPort !== defaultPort ? `:${explicitPort}` : "";
  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${port}`;
}

export function normalizeAllowedWidgetOrigins(values: unknown): string[] | null {
  if (!Array.isArray(values)) return null;
  if (values.length > 32) return null;
  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") return null;
    const origin = normalizeHttpOrigin(value);
    if (!origin) return null;
    if (!normalized.includes(origin)) normalized.push(origin);
  }
  return normalized;
}

export function buildFrameAncestorsDirective(allowedOrigins: readonly string[]): string {
  return allowedOrigins.length > 0 ? `frame-ancestors ${allowedOrigins.join(" ")}` : "frame-ancestors 'none'";
}

function resolveBackend(env: WidgetOriginPolicyEnvironment): "supabase" | "local" {
  if (env.DATA_BACKEND === "local") return "local";
  if (env.DATA_BACKEND === "supabase") return "supabase";
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  return url && secret ? "supabase" : "local";
}

function localAllowedOrigins(merchantKey: string): string[] | null {
  const merchant = catalog.merchant as { publicKey?: unknown; allowedWidgetOrigins?: unknown };
  if (merchant.publicKey !== merchantKey) return null;
  return normalizeAllowedWidgetOrigins(merchant.allowedWidgetOrigins);
}

async function supabaseAllowedOrigins(
  merchantKey: string,
  env: WidgetOriginPolicyEnvironment,
  fetchImpl: typeof fetch,
): Promise<string[] | null> {
  const baseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  const normalizedBaseUrl = normalizeHttpOrigin(baseUrl);
  if (!normalizedBaseUrl || !secret) throw new Error("Supabase widget-origin policy credentials are not configured");

  const request = async (query: URL) => fetchImpl(query, {
    cache: "no-store",
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      accept: "application/vnd.pgrst.object+json",
    },
  });

  const merchantQuery = new URL("/rest/v1/merchants", normalizedBaseUrl);
  merchantQuery.searchParams.set("select", "allowed_widget_origins");
  merchantQuery.searchParams.set("public_key", `eq.${merchantKey}`);
  merchantQuery.searchParams.set("status", "eq.active");
  merchantQuery.searchParams.set("limit", "1");

  let response = await request(merchantQuery);
  if (response.status === 406) {
    const integrationQuery = new URL("/rest/v1/platform_integrations", normalizedBaseUrl);
    integrationQuery.searchParams.set("select", "merchant_id");
    integrationQuery.searchParams.set("external_store_id", `eq.${merchantKey}`);
    integrationQuery.searchParams.set("status", `in.(${SERVING_COMMERCE_INTEGRATION_STATUSES.join(",")})`);
    integrationQuery.searchParams.set("provider", "in.(salla,zid)");
    integrationQuery.searchParams.set("limit", "1");
    const integrationResponse = await request(integrationQuery);
    if (integrationResponse.status === 406) return null;
    if (!integrationResponse.ok) throw new Error(`Supabase widget integration policy query failed with ${integrationResponse.status}`);
    const integration = await integrationResponse.json() as SupabaseIntegrationPolicyResponse;
    if (typeof integration.merchant_id !== "string" || !integration.merchant_id) return null;

    const resolvedMerchantQuery = new URL("/rest/v1/merchants", normalizedBaseUrl);
    resolvedMerchantQuery.searchParams.set("select", "allowed_widget_origins");
    resolvedMerchantQuery.searchParams.set("id", `eq.${integration.merchant_id}`);
    resolvedMerchantQuery.searchParams.set("status", "eq.active");
    resolvedMerchantQuery.searchParams.set("limit", "1");
    response = await request(resolvedMerchantQuery);
  }

  if (response.status === 406) return null;
  if (!response.ok) throw new Error(`Supabase widget-origin policy query failed with ${response.status}`);
  const row = (await response.json()) as SupabaseMerchantPolicyRow | SupabasePolicyResponse;
  const allowedOrigins = normalizeAllowedWidgetOrigins(row.allowed_widget_origins);
  if (!allowedOrigins) throw new Error("Supabase widget-origin policy is malformed");
  return allowedOrigins;
}

function denied(
  reason: Exclude<WidgetOriginPolicy["reason"], "allowed">,
  parentOrigin: string | null = null,
  allowedOrigins: string[] = [],
): WidgetOriginPolicy {
  return { allowed: false, allowedOrigins, parentOrigin, reason };
}

export async function evaluateWidgetOriginPolicy(
  merchantKey: string | null | undefined,
  suppliedParentOrigin: string | null | undefined,
  options: WidgetOriginPolicyOptions = {},
): Promise<WidgetOriginPolicy> {
  if (!merchantKey || !WIDGET_MERCHANT_KEY_PATTERN.test(merchantKey)) return denied("invalid_merchant_key");
  if (!suppliedParentOrigin) return denied("missing_parent_origin");
  const parentOrigin = normalizeHttpOrigin(suppliedParentOrigin);
  if (!parentOrigin) return denied("invalid_parent_origin");

  const env = options.env ?? process.env;
  let allowedOrigins: string[] | null;
  try {
    allowedOrigins = resolveBackend(env) === "supabase"
      ? await supabaseAllowedOrigins(merchantKey, env, options.fetchImpl ?? fetch)
      : localAllowedOrigins(merchantKey);
  } catch {
    return denied("policy_unavailable", parentOrigin);
  }

  if (allowedOrigins === null) return denied("merchant_not_found", parentOrigin);
  if (!allowedOrigins.includes(parentOrigin)) return denied("origin_not_allowed", parentOrigin, allowedOrigins);
  return { allowed: true, allowedOrigins, parentOrigin, reason: "allowed" };
}
