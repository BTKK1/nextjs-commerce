import Link from "next/link";
import { ArrowRight, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface FeedbackAction {
  href: string;
  label: string;
}

export function ActionFeedback({
  query,
  warning,
  successTitle = "Saved successfully",
  successAction,
  secondaryAction,
}: {
  query?: Record<string, string | string[] | undefined>;
  warning?: string | null;
  successTitle?: string;
  successAction?: FeedbackAction;
  secondaryAction?: FeedbackAction;
}) {
  const error = first(query?.error);
  const notice = first(query?.notice);
  if (!error && !warning && !notice) return null;
  return (
    <DashboardTranslatedServer>
      <div className="mt-5 space-y-3">
        {error ? (
          <div role="alert" className="flex items-start gap-3 rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <CircleX className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
            <div><h2 className="font-bold">We couldn&apos;t complete that action</h2><p className="mt-1 text-sm leading-6">{error}</p><p className="mt-1 text-xs font-medium">Your live agent and saved configuration were not changed.</p></div>
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="rounded-[20px] border border-emerald-200 bg-[linear-gradient(135deg,#ECFDF5,#F7F5FF)] p-5 text-emerald-950 shadow-[0_16px_36px_-28px_rgba(5,150,105,.55)]">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><CircleCheck className="h-6 w-6" aria-hidden="true" /></span><div><h2 className="text-lg font-bold">{successTitle}</h2><p className="mt-1 text-sm leading-6">{notice}</p></div></div>
            {successAction || secondaryAction ? <div className="mt-4 flex flex-wrap gap-2 pl-[52px]">{successAction ? <Link href={successAction.href} className="inline-flex items-center gap-2 rounded-[12px] bg-[#5B2EFF] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(91,46,255,.2)]">{successAction.label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : null}{secondaryAction ? <Link href={secondaryAction.href} className="rounded-[12px] border border-[#CFC6F6] bg-white px-4 py-2.5 text-sm font-bold text-[#4A21D6]">{secondaryAction.label}</Link> : null}</div> : null}
          </div>
        ) : null}
        {warning ? <div role="alert" className="flex items-start gap-3 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><p>{warning}</p></div> : null}
      </div>
    </DashboardTranslatedServer>
  );
}
