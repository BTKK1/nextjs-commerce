"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useDashboardLocale } from "@/components/dashboard/DashboardLocale";

export function DraftSubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useDashboardLocale();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="focus-ring inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-[#5B2EFF] px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(91,46,255,.24)] transition hover:bg-[#4A21D6] disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
      {t(pending ? "Saving draft…" : "Save as draft")}
    </button>
  );
}
