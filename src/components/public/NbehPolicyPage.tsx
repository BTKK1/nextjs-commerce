import Link from "next/link";
import type { ReactNode } from "react";

type PolicySection = {
  title: string;
  titleAr: string;
  body: ReactNode;
  bodyAr: ReactNode;
};

export function NbehPolicyPage({
  eyebrow,
  eyebrowAr,
  title,
  titleAr,
  intro,
  introAr,
  sections,
}: {
  eyebrow: string;
  eyebrowAr: string;
  title: string;
  titleAr: string;
  intro: ReactNode;
  introAr: ReactNode;
  sections: PolicySection[];
}) {
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0b0e12]">
      <header className="border-b border-[#e4e6ec] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link className="flex items-center gap-3 rounded-xl focus-ring" href="/">
            <span className="grid size-10 place-items-center rounded-[14px] bg-[#5b2eff] shadow-[0_10px_30px_rgba(91,46,255,0.25)]">
              <svg aria-hidden="true" className="size-7" viewBox="0 0 120 120">
                <path
                  d="M34.1 0h51.8A34.1 34.1 0 0 1 120 34.1v51.8A34.1 34.1 0 0 1 85.9 120H10.3A10.3 10.3 0 0 1 0 109.7V34.1A34.1 34.1 0 0 1 34.1 0Zm39 60a13.1 13.1 0 1 0-26.2 0 13.1 13.1 0 1 0 26.2 0Z"
                  fill="white"
                  fillRule="evenodd"
                />
              </svg>
            </span>
            <span>
              <span className="block text-lg font-semibold leading-none">Nbeh</span>
              <span className="mt-1 block text-xs text-[#5c6272]">AI sales agent</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link
              className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-[#5c6272] transition hover:bg-[#f1efff] hover:text-[#4a21d6] sm:inline-flex"
              href="/support"
            >
              Support
            </Link>
            <Link
              className="rounded-xl bg-[#5b2eff] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(91,46,255,0.22)] transition hover:bg-[#4a21d6]"
              href="/login"
            >
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="overflow-hidden rounded-[32px] border border-[#e4e6ec] bg-white shadow-[0_24px_90px_rgba(11,14,18,0.08)]">
          <div className="relative isolate overflow-hidden border-b border-[#e4e6ec] px-6 py-10 sm:px-10 sm:py-14">
            <div className="absolute -right-32 -top-40 -z-10 size-96 rounded-full bg-[#ede8ff] blur-3xl" />
            <div className="absolute -bottom-40 left-10 -z-10 size-80 rounded-full bg-[#e8f9ef] blur-3xl" />

            <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
              <section lang="en" dir="ltr">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b2eff]">{eyebrow}</p>
                <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h1>
                <div className="mt-5 max-w-2xl text-base leading-8 text-[#5c6272]">{intro}</div>
              </section>

              <section className="lg:border-l lg:border-[#e4e6ec] lg:pl-12" lang="ar" dir="rtl">
                <p className="text-sm font-semibold text-[#5b2eff]">{eyebrowAr}</p>
                <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{titleAr}</h2>
                <div className="mt-5 max-w-2xl text-base leading-8 text-[#5c6272]">{introAr}</div>
              </section>
            </div>
          </div>

          <div className="grid gap-px bg-[#e4e6ec] lg:grid-cols-2">
            {sections.map((section) => (
              <article className="grid gap-8 bg-white p-6 sm:p-9" key={section.title}>
                <section lang="en" dir="ltr">
                  <h2 className="text-xl font-semibold tracking-[-0.02em]">{section.title}</h2>
                  <div className="mt-3 text-sm leading-7 text-[#5c6272]">{section.body}</div>
                </section>
                <section className="border-t border-[#e4e6ec] pt-7" lang="ar" dir="rtl">
                  <h3 className="text-xl font-semibold">{section.titleAr}</h3>
                  <div className="mt-3 text-sm leading-7 text-[#5c6272]">{section.bodyAr}</div>
                </section>
              </article>
            ))}
          </div>
        </div>

        <footer className="mt-8 flex flex-col gap-4 text-sm text-[#5c6272] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Nbeh. Built for product-page conversations.</p>
          <div className="flex flex-wrap gap-4">
            <Link className="hover:text-[#5b2eff]" href="/privacy">Privacy</Link>
            <Link className="hover:text-[#5b2eff]" href="/terms">Terms</Link>
            <Link className="hover:text-[#5b2eff]" href="/faq">FAQ</Link>
            <Link className="hover:text-[#5b2eff]" href="/support">Support</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
