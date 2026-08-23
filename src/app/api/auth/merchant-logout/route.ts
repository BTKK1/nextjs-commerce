import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { clearFounderSession } from "@/lib/auth/founder-session";
import { isSameOriginMutation } from "@/lib/integrations/registry";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
  await clearFounderSession();
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {}
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
