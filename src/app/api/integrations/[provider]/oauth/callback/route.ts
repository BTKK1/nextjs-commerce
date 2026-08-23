import { NextResponse } from "next/server";
import { hashOAuthState, isCommerceProvider } from "@/lib/integrations/registry";
import { installZidStore } from "@/lib/integrations/zid-installation";
import { createServiceClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function diagnosticMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (!error || typeof error !== "object" || Array.isArray(error)) return String(error).slice(0, 500) || "unknown error";
  const details = error as Record<string, unknown>;
  return [details.code, details.message, details.details, details.hint]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" | ")
    .slice(0, 500) || "unknown error";
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!isCommerceProvider(provider)) return NextResponse.json({ error: "Unsupported commerce provider" }, { status: 404 });
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!code || (!state && provider !== "zid")) return NextResponse.json({ error: "OAuth callback is missing code or state" }, { status: 400 });

  const supabase = createServiceClient();
  let oauthState: string | null = null;
  if (state) {
    const { data, error: consumeError } = await supabase.rpc("consume_oauth_state_atomic", {
      target_provider: provider,
      target_state_hash: hashOAuthState(state),
      consumed_time: new Date().toISOString(),
    });
    if (consumeError) return NextResponse.json({ error: "OAuth state could not be consumed" }, { status: 503 });
    if (!data) return NextResponse.json({ error: "OAuth state is invalid or expired" }, { status: 400 });
    oauthState = String(data);
  }

  if (provider === "zid") {
    try {
      const installation = await installZidStore(code, oauthState);
      const destination = new URL(state ? "/dashboard/integrations" : "/login", request.url);
      destination.searchParams.set("connected", "zid");
      destination.searchParams.set("store", installation.storeId);
      return NextResponse.redirect(destination, 303);
    } catch (error) {
      console.error("[nbeh] zid_oauth_install_failed", diagnosticMessage(error));
      return NextResponse.json({ error: "Could not finish the Zid store connection" }, { status: 503 });
    }
  }

  return NextResponse.json({
    status: "pending_token_vault",
    provider,
    message: "OAuth callback validated. Token exchange is intentionally disabled until approved credentials and a production secret vault are configured.",
  }, { status: 202 });
}
