import type { LucideIcon } from "lucide-react";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";

export function EmptyState({ title, body, icon: Icon }: { title: string; body: string; icon: LucideIcon }) {
  return (
    <DashboardTranslatedServer><div className="rounded-[20px] border border-dashed border-[#CFC6F6] bg-[radial-gradient(circle_at_50%_0%,#F2EEFF,white_58%)] p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDE8FF] text-[#5B2EFF]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
      <h2 className="mt-3 font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
    </div></DashboardTranslatedServer>
  );
}
