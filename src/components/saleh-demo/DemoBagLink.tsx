"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { DEMO_BAG_EVENT, getDemoBagCount, readDemoBag } from "@/lib/demo-bag";
import { useEffect, useState } from "react";

export function DemoBagLink({ label = "Bag", href = "/cart" }: { label?: string; href?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(getDemoBagCount(readDemoBag()));
    sync();
    window.addEventListener(DEMO_BAG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DEMO_BAG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <Link
      href={href}
      className="relative inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-ink hover:text-[#8a6b47]"
      data-testid="bag-link"
      aria-label={`${label} (${count})`}
    >
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="tabular-nums" data-testid="bag-count">
        ({count})
      </span>
    </Link>
  );
}
