import { PlugZap } from "lucide-react";

export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className="border-y border-stone-200 bg-[#f3ede3]">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-sm text-[#4c3d2c] sm:px-6 lg:px-8">
        <PlugZap className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <p>
          {compact
            ? "Maison Vert uses the referenced catalog and local browser checkout interactions."
            : "This Maison Vert demo uses the referenced product catalog and local browser checkout. No live payment, inventory, or external commerce platform is connected."}
        </p>
      </div>
    </div>
  );
}
