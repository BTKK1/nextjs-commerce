import type { MerchantRole } from "@/lib/supabase/types";

export const DASHBOARD_READ_ROLES: MerchantRole[] = ["founder", "owner", "admin", "advanced_admin", "viewer"];
export const DASHBOARD_ADMIN_ROLES: MerchantRole[] = ["founder", "owner", "admin", "advanced_admin"];
export const ADVANCED_AGENT_ROLES: MerchantRole[] = ["founder", "owner", "advanced_admin"];
export const INTEGRATION_ADMIN_ROLES: MerchantRole[] = ["founder", "owner", "admin"];

export function hasRole(role: MerchantRole | null | undefined, allowed: readonly MerchantRole[]): boolean {
  return Boolean(role && allowed.includes(role));
}

export function canReadDashboard(role: MerchantRole | null | undefined): boolean {
  return hasRole(role, DASHBOARD_READ_ROLES);
}

export function canManageProducts(role: MerchantRole | null | undefined): boolean {
  return hasRole(role, DASHBOARD_ADMIN_ROLES);
}

export function canManageAdvancedAgent(role: MerchantRole | null | undefined): boolean {
  return hasRole(role, ADVANCED_AGENT_ROLES);
}

export function canManageIntegrations(role: MerchantRole | null | undefined): boolean {
  return hasRole(role, INTEGRATION_ADMIN_ROLES);
}

export function canManageGlobalAgent(role: MerchantRole | null | undefined): boolean {
  return role === "founder";
}
