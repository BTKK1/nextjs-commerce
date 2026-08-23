import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveDataBackend } from "@/lib/backend/mode";
import { canManageAdvancedAgent, canManageProducts, canReadDashboard } from "@/lib/auth/roles";
import { DEMO_MERCHANT_ID } from "@/lib/supabase/constants";
import type { MerchantRole } from "@/lib/supabase/types";
import { getFounderSession } from "@/lib/auth/founder-session";

export interface DashboardIdentity {
  userId: string | null;
  email: string | null;
  merchantId: string;
  role: MerchantRole;
  authMode: "supabase" | "local_demo" | "founder";
}

function demoIdentity(): DashboardIdentity {
  return {
    userId: null,
    email: "local-demo@ai-sales-agent.invalid",
    merchantId: DEMO_MERCHANT_ID,
    role: "owner",
    authMode: "local_demo",
  };
}

export async function getDashboardIdentity(): Promise<DashboardIdentity | null> {
  const founder = await getFounderSession();
  if (founder) return { userId: null, email: founder.email, merchantId: DEMO_MERCHANT_ID, role: "founder", authMode: "founder" };
  const demoAllowed = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (resolveDataBackend() === "local") return demoAllowed ? demoIdentity() : null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: membership, error } = await supabase
      .from("merchant_users")
      .select("merchant_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!membership) return null;
    return {
      userId: user.id,
      email: user.email ?? null,
      merchantId: String(membership.merchant_id),
      role: membership.role as MerchantRole,
      authMode: "supabase",
    };
  } catch (error) {
    throw new Error("Supabase dashboard authentication is unavailable.", { cause: error });
  }
}

export async function requireDashboardUser(): Promise<DashboardIdentity> {
  const identity = await getDashboardIdentity();
  if (!identity) redirect("/login?next=/dashboard");
  if (!canReadDashboard(identity.role)) redirect("/login?error=unauthorized");
  return identity;
}

export async function requireAdvancedAgentUser(): Promise<DashboardIdentity> {
  const identity = await requireDashboardUser();
  if (!canManageAdvancedAgent(identity.role)) redirect("/dashboard/agent?error=advanced_access_required");
  return identity;
}

export async function requireDashboardAdminUser(): Promise<DashboardIdentity> {
  const identity = await requireDashboardUser();
  if (!canManageProducts(identity.role)) redirect("/dashboard?error=admin_access_required");
  return identity;
}
