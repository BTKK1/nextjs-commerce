import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
}

export function KpiCard({ label, value, detail, icon: Icon }: KpiCardProps) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-600">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-qahwa">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-600">{detail}</p>
    </div>
  );
}
