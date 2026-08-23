import { NextResponse } from "next/server";
import { canManageIntegrations } from "@/lib/auth/roles";
import { getDashboardIdentity } from "@/lib/auth/require-user";
import { buildAuthorizationUrl, createOAuthState, getProviderReadiness, isCommerceProvider, isSameOriginMutation } from "@/lib/integrations/registry";
import { createServiceClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function failure(request: Request, message: string, status: number) {
  if (!request.headers.get("accept")?.includes("text/html")) return NextResponse.json({ error: message }, { status });
  const url = new URL("/dashboard/integrations", request.url);
  url.searchParams.set("error", message);
  url.hash = "dashboard-feedback";
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!isSameOriginMutation(request)) return failure(request, "The connection request could not be verified. Refresh the page and try again.", 403);
  const identity = await getDashboardIdentity();
  if (!identity || !canManageIntegrations(identity.role)) return failure(request, "Integration administrator access is required.", 403);
  const { provider } = await context.params;
  if (!isCommerceProvider(provider)) return failure(request, "This store provider is not supported.", 404);

  const readiness = getProviderReadiness(provider);
  if (!readiness.credentialsConfigured) {
    return failure(request, "This provider is not ready to connect yet. Check the app credentials and approval status.", 503);
  }
  if (provider === "salla") {
    const installationUrl = process.env.SALLA_INSTALL_URL || "https://s.salla.sa/apps/install/1132747795";
    const wantsJson = request.headers.get("accept")?.includes("application/json");
    return wantsJson
      ? NextResponse.json({ authorizationUrl: installationUrl, mode: "easy" })
      : NextResponse.redirect(installationUrl, 303);
  }
  const authorizationUrl = buildAuthorizationUrl(provider, "pending");
  if (!authorizationUrl) return failure(request, "The provider connection URL is not configured yet.", 503);

  const { token, hash } = createOAuthState();
  authorizationUrl.searchParams.set("state", token);
  const supabase = createServiceClient();
  const { error: stateError } = await supabase.rpc("prepare_oauth_connection_atomic", {
    target_merchant_id: identity.merchantId,
    target_provider: provider,
    requested_scopes: readiness.requiredScopes,
    target_state_hash: hash,
    target_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    actor_user_id: identity.userId,
  });
  if (stateError) return failure(request, "The secure connection could not be started. Please try again.", 500);

  const wantsJson = request.headers.get("accept")?.includes("application/json");
  return wantsJson
    ? NextResponse.json({ authorizationUrl: authorizationUrl.toString(), expiresInSeconds: 600 })
    : NextResponse.redirect(authorizationUrl);
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== "zid") {
    return NextResponse.json({ error: "OAuth initiation requires POST" }, { status: 405, headers: { Allow: "POST" } });
  }

  // Zid opens the app's redirection URL immediately after a merchant activates
  // the app. That first request does not contain an authorization code, so it
  // must start Zid OAuth instead of being sent directly to the callback route.
  const readiness = getProviderReadiness("zid");
  if (!readiness.credentialsConfigured) {
    return failure(request, "Zid is not ready to connect yet. Check the app credentials and callback URL.", 503);
  }
  const authorizationUrl = buildAuthorizationUrl("zid", "pending");
  if (!authorizationUrl) return failure(request, "The Zid connection URL is not configured yet.", 503);

  // Zid's direct marketplace install has no Nbeh dashboard identity yet. The
  // callback intentionally supports this provider-managed flow without a local
  // OAuth state and resolves the tenant from Zid's signed token response.
  authorizationUrl.searchParams.delete("state");
  return NextResponse.redirect(authorizationUrl);
}
