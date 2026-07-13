"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { localeFromStorePath, STORE_LOCALE_KEY, type StoreLocale } from "@/components/saleh-demo/store-i18n";

interface StoreLocaleContextValue {
  locale: StoreLocale;
  setLocale: (locale: StoreLocale) => void;
}

const StoreLocaleContext = createContext<StoreLocaleContextValue | null>(null);

export function StoreLocaleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const locale = localeFromStorePath(pathname);

  useEffect(() => {
    window.localStorage.setItem(STORE_LOCALE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo<StoreLocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        window.localStorage.setItem(STORE_LOCALE_KEY, nextLocale);
        document.documentElement.lang = nextLocale;
        document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
      },
    }),
    [locale],
  );

  return <StoreLocaleContext.Provider value={value}>{children}</StoreLocaleContext.Provider>;
}

export function useStoreLocale() {
  const context = useContext(StoreLocaleContext);
  if (!context) {
    throw new Error("useStoreLocale must be used inside StoreLocaleProvider");
  }
  return context;
}
