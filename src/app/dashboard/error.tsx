"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useDashboardLocale } from "@/components/dashboard/DashboardLocale";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useDashboardLocale();
  useEffect(() => {
    console.error("[nbeh dashboard] recovered route error", { digest: error.digest ?? "unavailable" });
  }, [error]);
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-[24px] border border-[#E5DDF8] bg-white shadow-[0_24px_70px_-40px_rgba(52,31,116,.45)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#5B2EFF,#9B7BFF,#F3B94F)]" />
        <div className="p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><AlertTriangle className="h-6 w-6" aria-hidden="true" /></span>
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[#17131F]">{t("This section could not load")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#666170]">{t("Your live agent and saved data were not changed. Retry this section or return to the dashboard while Nbeh recovers.")}</p>
          {error.digest ? <p className="mt-4 text-xs text-[#8A8593]">{t("Support reference")}: <code className="rounded bg-[#F4F1FA] px-2 py-1">{error.digest}</code></p> : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={reset} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[#5B2EFF] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#4A21D6]"><RefreshCw className="h-4 w-4" />{t("Retry this section")}</button>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-[#D8D2E7] px-4 py-2.5 text-sm font-bold text-[#393344] transition hover:border-[#5B2EFF] hover:text-[#5B2EFF]"><ArrowLeft className="h-4 w-4" />{t("Back to dashboard")}</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
