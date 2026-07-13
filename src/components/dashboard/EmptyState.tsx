import type { LucideIcon } from "lucide-react";

export function EmptyState({ title, body, icon: Icon }: { title: string; body: string; icon: LucideIcon }) {
  return (
    <div className="rounded-md border border-dashed border-stone-300 bg-white p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-stone-400" aria-hidden="true" />
      <h2 className="mt-3 font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
    </div>
  );
}
