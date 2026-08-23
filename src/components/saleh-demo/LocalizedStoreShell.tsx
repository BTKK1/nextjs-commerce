"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Globe2 } from "lucide-react";
import { DemoBagLink } from "@/components/saleh-demo/DemoBagLink";
import { StoreLocaleProvider, useStoreLocale } from "@/components/saleh-demo/StoreLocaleProvider";
import { getLanguageRoutes, localizeStorePath, storeCopy, type StoreLocale } from "@/components/saleh-demo/store-i18n";

export function LocalizedStoreShell({ children }: { children: ReactNode }) {
  return (
    <StoreLocaleProvider>
      <StoreShellContent>{children}</StoreShellContent>
    </StoreLocaleProvider>
  );
}

function StoreShellContent({ children }: { children: ReactNode }) {
  const { locale } = useStoreLocale();
  const pathname = usePathname() || "/";
  const copy = storeCopy[locale];
  const localizedHref = (href: string) => localizeStorePath(href, locale);

  return (
    <main className="min-h-screen bg-[#faf8f3] text-ink" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <header className="sticky top-0 z-[100] border-b border-stone-200 bg-[#faf8f3]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 xss:px-7.5">
          <Link href={localizedHref("/")} className="shrink-0 text-2xl font-semibold tracking-tight text-ink">
            Maison Vert
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold uppercase tracking-[0.16em] text-stone-500 md:flex">
            <Link href={localizedHref("/#collection")} className="hover:text-ink">
              {copy.nav.shop}
            </Link>
            <Link href={localizedHref("/#story")} className="hover:text-ink">
              {copy.nav.story}
            </Link>
            <Link href={localizedHref("/#journal")} className="hover:text-ink">
              {copy.nav.journal}
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <LanguageToggle locale={locale} pathname={pathname} />
            <DemoBagLink label={copy.nav.bag} href={localizedHref("/cart")} />
          </div>
        </div>
      </header>
      <div className="mx-auto min-h-[calc(100vh-180px)] w-full">{children}</div>
      <footer className="mt-20 border-t border-stone-200 bg-[#f3ede3]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 xss:px-7.5 md:grid-cols-4">
          <div>
            <p className="text-2xl font-semibold">Maison Vert</p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-stone-600">{copy.footer.description}</p>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">{copy.footer.shop}</p>
            <ul className="space-y-2 text-sm text-stone-700">
              {copy.footer.categories.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">{copy.footer.help}</p>
            <ul className="space-y-2 text-sm text-stone-700">
              {copy.footer.helpItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">{copy.footer.newsletter}</p>
            <p className="text-sm leading-6 text-stone-600">{copy.footer.newsletterText}</p>
            <form className="mt-3 flex gap-2" action={localizedHref("/#collection")}>
              <input
                type="email"
                placeholder={copy.footer.emailPlaceholder}
                className="w-full border-b border-stone-300 bg-transparent py-2 text-sm outline-none placeholder:text-stone-600 focus:border-ink"
              />
              <button className="text-sm font-semibold uppercase tracking-[0.18em] text-ink hover:text-[#7d623f]">
                {copy.footer.join}
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-stone-200 py-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">
          &copy; 2026 Maison Vert
        </div>
      </footer>
    </main>
  );
}

function LanguageToggle({ locale, pathname }: { locale: StoreLocale; pathname: string }) {
  const router = useRouter();
  const copy = storeCopy[locale].nav;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { englishPath, arabicPath } = getLanguageRoutes(pathname);
  const activeLanguageLabel = locale === "ar" ? "AR" : "EN";

  useEffect(() => {
    router.prefetch(englishPath);
    router.prefetch(arabicPath);
  }, [arabicPath, englishPath, router]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function prepareLanguageSwitch(nextLocale: StoreLocale, href: string) {
    document.documentElement.setAttribute("lang", nextLocale);
    document.documentElement.setAttribute("dir", nextLocale === "ar" ? "rtl" : "ltr");
    window.localStorage.setItem("maison-vert-locale", nextLocale);
    router.prefetch(href);
    router.push(href);
    setOpen(false);
  }

  const options = [
    { locale: "en" as const, label: copy.english, shortLabel: "EN", href: englishPath },
    { locale: "ar" as const, label: copy.arabic, shortLabel: "AR", href: arabicPath },
  ];

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-2 border border-stone-300 bg-white px-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-stone-100"
        aria-label={`${copy.languageLabel}: ${locale === "ar" ? copy.arabic : copy.english}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        data-testid="store-language-trigger"
      >
        <Globe2 className="h-4 w-4" aria-hidden="true" />
        <span>{activeLanguageLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={`absolute top-[calc(100%+6px)] z-[70] min-w-40 border border-stone-200 bg-white p-1 shadow-[0_20px_48px_-32px_rgba(41,37,36,0.45)] ${
            locale === "ar" ? "left-0" : "right-0"
          }`}
          role="menu"
          aria-label={copy.languageLabel}
          data-testid="store-language-menu"
        >
          {options.map((option) => (
            <button
              key={option.locale}
              type="button"
              className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-sm font-semibold transition ${
                locale === option.locale ? "bg-ink text-white" : "text-stone-700 hover:bg-stone-100 hover:text-ink"
              }`}
              aria-current={locale === option.locale ? "page" : undefined}
              role="menuitem"
              onMouseEnter={() => router.prefetch(option.href)}
              onFocus={() => router.prefetch(option.href)}
              onClick={() => prepareLanguageSwitch(option.locale, option.href)}
              data-testid={`store-language-option-${option.locale}`}
            >
              <span>{option.label}</span>
              <span className="text-xs uppercase tracking-[0.16em]">{option.shortLabel}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
