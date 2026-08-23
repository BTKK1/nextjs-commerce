"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bot, Boxes, ChevronDown, Crown, ExternalLink, FileClock, Gauge, Menu, MessageSquareText, Plug, Settings, Sparkles, X } from "lucide-react";
import type { MerchantRole } from "@/lib/supabase/types";
import { DashboardTranslated, useDashboardLocale } from "@/components/dashboard/DashboardLocale";

const links = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/dashboard/insights", label: "Insights", icon: Sparkles },
  { href: "/dashboard/products", label: "Products", icon: Boxes },
  { href: "/dashboard/agent", label: "Agent", icon: Bot },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/audit-log", label: "Audit Log", icon: FileClock },
];

function NbehMark() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 120 120">
      <path fill="currentColor" fillRule="evenodd" d="M34.1 0h51.8A34.1 34.1 0 0 1 120 34.1v51.8A34.1 34.1 0 0 1 85.9 120H10.3A10.3 10.3 0 0 1 0 109.7V34.1A34.1 34.1 0 0 1 34.1 0Zm39 60a13.1 13.1 0 1 0-26.2 0 13.1 13.1 0 1 0 26.2 0Z" />
    </svg>
  );
}

export function DashboardNav({ role = "owner" }: { role?: MerchantRole }) {
  const { t } = useDashboardLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const viewerHidden = new Set(["/dashboard/products", "/dashboard/agent", "/dashboard/settings", "/dashboard/audit-log"]);
  const roleLinks = role === "founder" ? [{ href: "/dashboard/platform", label: "Global Agent", icon: Crown }, ...links] : links;
  const visibleLinks = roleLinks.filter((link) => role !== "viewer" || !viewerHidden.has(link.href)).filter((link) => link.href !== "/dashboard/agent" || role === "founder" || role === "owner" || role === "advanced_admin");

  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const current = visibleLinks.find((link) => isActive(link.href)) ?? visibleLinks[0];

  return (
    <DashboardTranslated><aside className="sticky top-0 z-40 shrink-0 border-b border-[#E4E6EC] bg-white/95 backdrop-blur-xl lg:h-screen lg:w-[284px] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="px-3 py-3 sm:px-4 lg:flex lg:min-h-full lg:flex-col lg:p-5">
        <div className="flex items-center justify-between px-1 lg:px-2 lg:py-2">
          <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="group flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B2EFF]">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#5B2EFF] text-white shadow-[0_10px_26px_rgba(91,46,255,0.28)] transition duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[-2deg]">
              <NbehMark />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#22C55E]" />
            </span>
            <span className="leading-none">
              <span className="block text-lg font-bold tracking-[-0.035em] text-[#0B0E12]">Nbeh</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#686271]">{t("Sales intelligence")}</span>
            </span>
          </Link>
          {role === "founder" ? <Crown className="h-4 w-4 text-[#5B2EFF] lg:hidden" aria-label={t("Founder")} /> : null}
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="dashboard-mobile-menu"
            aria-label={t(mobileOpen ? "Close menu" : "Open menu")}
            onClick={() => setMobileOpen((open) => !open)}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-[13px] border border-[#D8D1F3] bg-[#F7F5FF] px-3 text-sm font-bold text-[#4A21D6] lg:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            <span>{t(current?.label ?? "Menu")}</span>
            <ChevronDown className={`h-4 w-4 transition ${mobileOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 hidden rounded-[20px] border border-[#DDD6FE] bg-[linear-gradient(145deg,#F5F2FF,#ECE7FF)] p-4 lg:block">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#5B2EFF]">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("Nbeh is live")}
          </div>
          <p className="mt-2 text-sm leading-5 text-[#5C6272]">{t("Your sales agent is learning from every shopper conversation.")}</p>
        </div>

        <nav id="dashboard-mobile-menu" aria-label={t("Dashboard")} className={`${mobileOpen ? "grid" : "hidden"} mt-3 grid-cols-2 gap-2 rounded-[18px] border border-[#E2DDF7] bg-[#FAF9FF] p-2 lg:mt-6 lg:block lg:space-y-1.5 lg:border-0 lg:bg-transparent lg:p-0`}>
          {visibleLinks.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group flex min-w-0 items-center gap-2.5 rounded-[13px] px-3 py-2.5 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B2EFF] focus-visible:ring-offset-2 ${active ? "bg-[#5B2EFF] text-white shadow-[0_9px_22px_rgba(91,46,255,0.22)]" : "bg-white text-[#5C6272] hover:bg-[#F3F0FF] hover:text-[#5B2EFF] lg:bg-transparent"}`}
              >
                <Icon className={`h-[18px] w-[18px] transition-transform ${active ? "" : "group-hover:scale-105"}`} aria-hidden="true" />
                {t(link.label)}
              </Link>
            );
          })}
        </nav>

        <Link href="/store" target="_blank" rel="noopener noreferrer" className={`${mobileOpen ? "flex" : "hidden"} mt-3 items-center justify-center gap-2 rounded-[13px] px-3 py-2.5 text-sm font-bold transition lg:mt-auto lg:flex ${role === "founder" ? "bg-[#17131F] text-white shadow-[0_10px_24px_rgba(23,19,31,0.15)] hover:bg-[#5B2EFF]" : "border border-[#D6D9E1] bg-white text-[#292530] hover:border-[#BFB3F4] hover:bg-[#F7F5FF] hover:text-[#5B2EFF]"}`}>
          <ExternalLink className="h-4 w-4" /> {t(role === "founder" ? "Founder demo store" : "View demo store")}
        </Link>
      </div>
    </aside></DashboardTranslated>
  );
}
