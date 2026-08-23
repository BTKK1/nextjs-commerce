import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next");
  const next = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data, error: claimError } = await supabase.rpc("claim_merchant_memberships_by_email");
      const result = Array.isArray(data) ? data[0] as { merchant_count?: number } | undefined : data as { merchant_count?: number } | null;
      if (!claimError && Number(result?.merchant_count ?? 0) > 0) {
        return NextResponse.redirect(new URL(next, url.origin));
      }
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=no_workspace", url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
