"use client";

import { Check, LoaderCircle, Save } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useDashboardLocale } from "@/components/dashboard/DashboardLocale";

export function SettingsSubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "dark";
}) {
  const { pending } = useFormStatus();
  const { t } = useDashboardLocale();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-live="polite"
      data-testid="settings-submit"
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-5 text-sm font-bold text-white transition disabled:cursor-wait disabled:opacity-75 ${
        variant === "primary"
          ? "bg-[#5B2EFF] shadow-[0_10px_24px_rgba(91,46,255,.24)] hover:-translate-y-0.5 hover:bg-[#4A21D6] disabled:hover:translate-y-0"
          : "bg-[#17131F] shadow-[0_10px_24px_rgba(23,19,31,.18)] hover:bg-[#2E2838]"
      }`}
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        variant === "primary" ? <Save className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{t(pending ? pendingLabel : label)}</span>
    </button>
  );
}
