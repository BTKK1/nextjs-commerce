import localFont from "next/font/local";
import Link from "next/link";
import { ExternalLink, Store } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { DashboardLocale, DashboardLocaleProvider } from "@/components/dashboard/DashboardLocale";
import { requireDashboardUser } from "@/lib/auth/require-user";
import { getDashboardLocale } from "@/lib/dashboard/i18n";
import { translateDashboardText } from "@/lib/dashboard/translations";

const dashboardFont = localFont({
  src: [
    { path: "../fonts/space-grotesk-300.ttf", weight: "300", style: "normal" },
    { path: "../fonts/space-grotesk-400.ttf", weight: "400", style: "normal" },
    { path: "../fonts/space-grotesk-500.ttf", weight: "500", style: "normal" },
    { path: "../fonts/space-grotesk-600.ttf", weight: "600", style: "normal" },
    { path: "../fonts/space-grotesk-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-nbeh-dashboard",
  display: "swap",
});

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [identity, locale] = await Promise.all([requireDashboardUser(), getDashboardLocale()]);
  const t = (text: string) => translateDashboardText(text, locale);
  const roleLabel = identity.role.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
  return (
    <DashboardLocaleProvider initialLocale={locale}>
    <div data-dashboard-shell dir={locale === "ar" ? "rtl" : "ltr"} className={`${dashboardFont.variable} min-h-screen lg:flex lg:items-start`}>
      <DashboardNav role={identity.role} />
      <div data-dashboard-content className="relative min-w-0 flex-1 overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(ellipse_at_70%_-15%,rgba(91,46,255,0.13),transparent_62%)]" />
        <div className="relative flex min-h-[58px] items-center justify-between border-b border-[#E4E6EC] bg-white/80 px-4 text-xs text-[#5C6272] backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#22C55E] shadow-[0_0_0_4px_rgba(34,197,94,0.11)]" />
            <span className="truncate font-medium">{identity.email ?? "Local demo owner"}</span>
            <span className="hidden rounded-full border border-[#DCD5F7] bg-[#F3F0FF] px-2.5 py-1 font-semibold capitalize text-[#5B2EFF] sm:inline-flex">
              {t(roleLabel)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DashboardLocale />
            {identity.role === "founder" ? <Link href="/store" target="_blank" rel="noopener noreferrer" aria-label={t("Demo store")} className="hidden items-center gap-2 rounded-full border border-[#D8D1F3] bg-[#F5F2FF] px-3 py-2 font-bold text-[#5B2EFF] transition hover:border-[#5B2EFF] hover:bg-white sm:inline-flex"><Store className="h-3.5 w-3.5" aria-hidden="true" /><span>{t("Demo store")}</span><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link> : null}
            {identity.authMode !== "local_demo" ? (
              <form action="/api/auth/merchant-logout" method="post">
                <button className="rounded-full px-2 py-2 font-semibold text-[#4F4B59] transition hover:bg-[#F0ECFA] hover:text-[#5B2EFF] sm:px-3">{t("Log out")}</button>
              </form>
            ) : <span className="hidden font-medium md:inline">{t("Local development access")}</span>}
          </div>
        </div>
        <div className="relative">{children}</div>
      </div>
    </div>
    </DashboardLocaleProvider>
  );
}
