"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useDashboardLocale } from "@/components/dashboard/DashboardLocale";

export function DashboardActionButton({
  label,
  pendingLabel = "Working…",
  confirmation,
  className = "",
  name,
  value,
  disabled = false,
}: {
  label: string;
  pendingLabel?: string;
  confirmation?: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const { t } = useDashboardLocale();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      aria-live="polite"
      onClick={(event) => {
        if (!pending && confirmation && !window.confirm(t(confirmation))) {
          event.preventDefault();
        }
      }}
      className={`${className} inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      <span>{t(pending ? pendingLabel : label)}</span>
    </button>
  );
}
