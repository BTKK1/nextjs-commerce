"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DashboardTranslated,
  useDashboardLocale,
} from "@/components/dashboard/DashboardLocale";
import { NbehSelect } from "@/components/dashboard/NbehSelect";

const links = [
  { href: "/dashboard/agent", label: "Agent home", exact: true },
  { href: "/dashboard/agent/advanced", label: "Edit agent" },
  { href: "/dashboard/agent/playground", label: "Playground" },
  { href: "/dashboard/agent/qa", label: "Test and publish" },
  { href: "/dashboard/agent/versions", label: "Versions" },
];

export function AgentSectionNav() {
  const { t } = useDashboardLocale();
  const pathname = usePathname();
  const router = useRouter();
  const selected =
    links.find((link) =>
      link.exact ? pathname === link.href : pathname.startsWith(link.href),
    ) ?? links[0];

  return (
    <DashboardTranslated>
      <div className="border-b border-stone-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="sm:hidden">
          <NbehSelect
            ariaLabel={t("Agent settings")}
            value={selected.href}
            onValueChange={(href) => router.push(href)}
            options={links.map((link) => ({
              value: link.href,
              label: link.label,
            }))}
            buttonClassName="bg-[#F7F5FF] font-bold"
          />
        </div>
        <nav aria-label={t("Agent settings")} className="hidden gap-1 sm:flex">
          {links.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring min-w-fit rounded-[13px] px-3 py-2 text-sm font-semibold transition-all ${active ? "bg-[#5B2EFF] text-white shadow-[0_8px_20px_rgba(91,46,255,.18)]" : "text-stone-600 hover:bg-[#F3F0FF] hover:text-[#5B2EFF]"}`}
              >
                {t(link.label)}
              </Link>
            );
          })}
        </nav>
      </div>
    </DashboardTranslated>
  );
}
