import type { LucideIcon } from "lucide-react";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";

interface KpiCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
}

export function KpiCard({ label, value, detail, icon: Icon }: KpiCardProps) {
  return (
    <DashboardTranslatedServer><div className="group rounded-[20px] border border-[#E4E6EC] bg-white p-5 shadow-[0_12px_32px_-24px_rgba(11,14,18,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-[#D6CCFF] hover:shadow-[0_18px_42px_-25px_rgba(91,46,255,0.32)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#5C6272]">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#0B0E12]">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EDE8FF] text-[#5B2EFF] transition duration-200 group-hover:scale-105 group-hover:bg-[#5B2EFF] group-hover:text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#6C7180]">{detail}</p>
    </div></DashboardTranslatedServer>
  );
}
