import { Suspense } from "react";
import Link from "next/link";
import { MerchantLoginForm } from "@/components/auth/MerchantLoginForm";

function NbehMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M34.1 0h51.8A34.1 34.1 0 0 1 120 34.1v51.8A34.1 34.1 0 0 1 85.9 120H10.3A10.3 10.3 0 0 1 0 109.7V34.1A34.1 34.1 0 0 1 34.1 0Zm39 60a13.1 13.1 0 1 0-26.2 0 13.1 13.1 0 1 0 26.2 0Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

function LoadingForm() {
  return (
    <div className="mt-8 space-y-5" aria-label="Loading secure sign in">
      <div className="h-[72px] animate-pulse rounded-2xl bg-[#F2F0F7]" />
      <div className="h-[72px] animate-pulse rounded-2xl bg-[#F2F0F7]" />
      <div className="h-13 animate-pulse rounded-2xl bg-[#E8E2FF]" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-[#F7F6FA] text-[#0B0E12]">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(91,46,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(91,46,255,0.045)_1px,transparent_1px)] [background-size:40px_40px]"
      />

      <div className="relative mx-auto grid min-h-svh max-w-[1600px] lg:grid-cols-[minmax(420px,0.92fr)_minmax(520px,1.08fr)]">
        <section className="relative hidden overflow-hidden bg-[#0B0E12] p-10 text-white lg:flex lg:min-h-svh lg:flex-col xl:p-14">
          <div aria-hidden="true" className="absolute -left-32 -top-36 h-[520px] w-[520px] rounded-full bg-[#5B2EFF]/45 blur-[110px]" />
          <div aria-hidden="true" className="absolute -bottom-48 -right-44 h-[620px] w-[620px] rounded-full bg-[#5B2EFF]/30 blur-[130px]" />
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:24px_24px]" />

          <Link href="/" className="relative z-10 flex w-fit items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-[#5B2EFF] shadow-[0_12px_35px_rgba(91,46,255,0.32)]">
              <NbehMark className="h-8 w-8" />
            </span>
            <span>
              <span className="block text-xl font-semibold tracking-[-0.02em]">Nbeh</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Sales intelligence</span>
            </span>
          </Link>

          <div className="relative z-10 my-auto max-w-xl py-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#7CFF9B] shadow-[0_0_14px_rgba(124,255,155,0.8)]" />
              Your sales agent is ready
            </span>
            <h2 className="mt-7 max-w-lg text-[clamp(2.75rem,4.4vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
              Every hesitation is a chance to <span className="text-[#A78BFA]">help.</span>
            </h2>
            <p className="mt-7 max-w-md text-lg leading-8 text-white/58">
              Understand what shoppers need, improve Nbeh&apos;s answers, and turn product questions into confident decisions.
            </p>

            <div className="mt-11 flex items-center gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[21px] bg-white text-[#5B2EFF] shadow-[0_18px_45px_rgba(91,46,255,0.28)]">
                <NbehMark className="h-12 w-12" />
                <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-[#0B0E12] bg-[#22C55E]" />
              </div>
              <div>
                <p className="font-semibold">Nbeh is learning from every conversation</p>
                <p className="mt-1 text-sm text-white/45">Insights, objections, and opportunities in one place.</p>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs text-white/30">© 2026 Nbeh AI · Built for Saudi commerce</p>
        </section>

        <section className="relative flex min-h-svh flex-col px-5 py-6 sm:px-9 sm:py-8 lg:px-14 xl:px-24">
          <header className="flex items-center justify-between lg:justify-end">
            <Link href="/" className="flex items-center gap-2.5 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#5B2EFF] text-white shadow-[0_10px_24px_rgba(91,46,255,0.24)]">
                <NbehMark className="h-7 w-7" />
              </span>
              <span className="text-lg font-semibold tracking-[-0.02em]">Nbeh</span>
            </Link>
            <Link
              href="/"
              className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-[#E2DFE9] bg-white/75 px-4 text-sm font-semibold text-[#4F4B59] shadow-sm backdrop-blur transition hover:border-[#CFC6F6] hover:text-[#5B2EFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B2EFF] focus-visible:ring-offset-2"
            >
              <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m12.5 4.5-5 5.5 5 5.5M8 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to website
            </Link>
          </header>

          <div className="mx-auto flex w-full max-w-[500px] flex-1 items-center py-10 sm:py-14">
            <div className="w-full rounded-[30px] border border-white/80 bg-white/88 p-6 shadow-[0_30px_90px_-40px_rgba(26,17,57,0.32),0_2px_8px_rgba(34,24,65,0.04)] backdrop-blur-xl sm:p-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#EEE9FF] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-[#5B2EFF]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M6.5 8V6.5a3.5 3.5 0 1 1 7 0V8m-8 0h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Secure merchant access
              </div>
              <h1 className="mt-5 text-[2.35rem] font-semibold leading-[1.06] tracking-[-0.045em] text-[#0B0E12] sm:text-[2.75rem]">
                Welcome back.
              </h1>
              <p className="mt-3 max-w-sm text-[15px] leading-6 text-[#686373]">
                Sign in to manage Nbeh, review shopper conversations, and find your next sales opportunity.
              </p>

              <Suspense fallback={<LoadingForm />}>
                <MerchantLoginForm />
              </Suspense>

              <div className="mt-8 flex items-center justify-center gap-2 border-t border-[#ECEAF0] pt-6 text-xs text-[#8C8795]">
                <svg className="h-3.5 w-3.5 text-[#5B2EFF]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 2.5 16 5v4.3c0 3.7-2.55 6.7-6 8.2-3.45-1.5-6-4.5-6-8.2V5l6-2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="m7.5 10 1.6 1.6 3.5-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Protected merchant workspace
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-[#9B96A4] lg:text-right">Installed Nbeh from Salla or Zid? Sign in with the same verified store-owner email.</p>
        </section>
      </div>
    </main>
  );
}
