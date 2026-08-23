import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";

export function StatusPill({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <DashboardTranslatedServer><span className="rounded-full bg-[#F1F2F5] px-2.5 py-1 text-xs font-medium text-[#5C6272]">None</span></DashboardTranslatedServer>;
  }

  const tone = value.includes("not_connected") || value.includes("disabled")
    ? "bg-[#F1F2F5] text-[#5C6272]"
    : value.includes("connected")
      ? "bg-emerald-50 text-qahwa"
      : value.includes("missing") || value.includes("fallback")
      ? "bg-amber-50 text-amber-800"
      : "bg-[#EDE8FF] text-[#4A21D6]";

  return <DashboardTranslatedServer><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{value.replaceAll("_", " ")}</span></DashboardTranslatedServer>;
}
