import Link from "next/link";
import type { ReactNode } from "react";

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3 md:px-8 lg:px-16 xl:px-28">
          <Link href="/" className="font-semibold text-ink">
            Maison Vert
          </Link>
          <Link href="/#collection" className="text-sm font-semibold text-[#7d623f] hover:underline">
            Continue shopping
          </Link>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-580px)] w-full px-4 md:px-8 lg:px-16 xl:px-28">
        {children}
      </main>
    </>
  );
}
