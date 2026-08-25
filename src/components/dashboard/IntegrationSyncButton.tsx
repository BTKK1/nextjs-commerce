"use client";

import { CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardTranslated, useDashboardLocale } from "@/components/dashboard/DashboardLocale";

export function IntegrationSyncButton({ provider, recovering = false }: { provider: string; recovering?: boolean }) {
  const router = useRouter();
  const { t } = useDashboardLocale();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function sync() {
    setPending(true);
    setResult(null);
    try {
      const response = await fetch(`/api/dashboard/integrations/${encodeURIComponent(provider)}/sync`, { method: "POST", credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Product sync failed");
      setResult({ kind: "success", message: recovering
        ? `${payload.recordsProcessed ?? 0} products synced. Store connection repaired.`
        : `${payload.recordsProcessed ?? 0} products updated` });
      router.refresh();
    } catch (error) {
      setResult({ kind: "error", message: error instanceof Error ? error.message : "Product sync failed" });
    } finally {
      setPending(false);
    }
  }

  return (
    <DashboardTranslated>
      <div className="space-y-2">
        <button type="button" onClick={sync} disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] border border-[#CFC6F6] bg-white px-3 py-2 text-xs font-bold text-[#4A21D6] disabled:cursor-wait disabled:opacity-70">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {t(pending ? "Syncing all products…" : recovering ? "Repair connection and sync" : "Sync products now")}
        </button>
        {result ? <p role={result.kind === "error" ? "alert" : "status"} className={`flex items-center gap-1.5 text-xs font-semibold ${result.kind === "error" ? "text-rose-700" : "text-emerald-700"}`}>{result.kind === "success" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}{t(result.message)}</p> : null}
      </div>
    </DashboardTranslated>
  );
}
