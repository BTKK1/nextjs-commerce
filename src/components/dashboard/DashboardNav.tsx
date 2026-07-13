"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, Gauge, MessageSquareText, Plug, Settings, Sparkles } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/dashboard/insights", label: "Insights", icon: Sparkles },
  { href: "/dashboard/products", label: "Products", icon: Boxes },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-stone-200 bg-white lg:min-h-[calc(100vh-65px)] lg:w-72 lg:border-b-0 lg:border-r">
      <div className="p-4 sm:p-6">
        <div className="rounded-md bg-ink p-4 text-white">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-saffron" aria-hidden="true" />
            <p className="font-semibold">Merchant dashboard</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-200">
            Demo insights for Saleh and store-owner walkthroughs.
          </p>
        </div>
        <nav className="mt-5 flex gap-2 overflow-x-auto lg:block lg:space-y-1">
          {links.map((link) => {
            const active =
              link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-emerald-50 text-qahwa" : "text-stone-700 hover:bg-stone-50"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
