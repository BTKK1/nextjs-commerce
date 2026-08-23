"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useDashboardLocale } from "@/components/dashboard/DashboardLocale";

export function CopyTranscriptButton({ transcript }: { transcript: string }) {
  const { t } = useDashboardLocale();
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(transcript); setCopied(true); }} className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold"><Copy className="h-4 w-4" aria-hidden="true"/>{t(copied ? "Copied" : "Copy transcript")}</button>;
}
