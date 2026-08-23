"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useDashboardLocale } from "@/components/dashboard/DashboardLocale";

interface ConfirmSubmitButtonProps {
  children: React.ReactNode;
  confirmation: string;
  pendingLabel?: string;
  className?: string;
}

export function ConfirmSubmitButton({ children, confirmation, pendingLabel = "Working…", className = "" }: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  const { t } = useDashboardLocale();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-live="polite"
      onClick={(event) => {
        if (!pending && !window.confirm(t(confirmation))) event.preventDefault();
      }}
      className={`${className} inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? t(pendingLabel) : children}
    </button>
  );
}
