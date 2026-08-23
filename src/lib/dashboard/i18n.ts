import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";

export type DashboardLocale = "en" | "ar";

export const DASHBOARD_LOCALE_COOKIE = "nbeh-dashboard-locale";

export const getDashboardLocale = cache(async (): Promise<DashboardLocale> => {
  const value = (await cookies()).get(DASHBOARD_LOCALE_COOKIE)?.value;
  return value === "ar" ? "ar" : "en";
});

export function dashboardDateLocale(locale: DashboardLocale) {
  return locale === "ar" ? "ar-SA" : "en-US";
}
