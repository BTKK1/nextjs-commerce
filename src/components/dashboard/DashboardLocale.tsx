"use client";

import { Languages } from "lucide-react";
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { DashboardLocale as DashboardLocaleValue } from "@/lib/dashboard/i18n";
import { translateDashboardText } from "@/lib/dashboard/translations";

const localeCookie = "nbeh-dashboard-locale";
const untranslatedElements = new Set([
  "textarea",
  "pre",
  "code",
  "script",
  "style",
]);

interface DashboardLocaleContextValue {
  locale: DashboardLocaleValue;
  selectLocale: (locale: DashboardLocaleValue) => void;
  t: (text: string) => string;
}

const DashboardLocaleContext =
  createContext<DashboardLocaleContextValue | null>(null);

function translateOptions(
  value: unknown,
  locale: DashboardLocaleValue,
): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option))
      return option;
    const item = option as Record<string, unknown>;
    return {
      ...item,
      ...(typeof item.label === "string"
        ? { label: translateDashboardText(item.label, locale) }
        : {}),
      ...(typeof item.description === "string"
        ? { description: translateDashboardText(item.description, locale) }
        : {}),
    };
  });
}

function translateNode(
  node: ReactNode,
  locale: DashboardLocaleValue,
): ReactNode {
  if (typeof node === "string") return translateDashboardText(node, locale);
  if (Array.isArray(node)) {
    if (
      node.every(
        (child) => typeof child === "string" || typeof child === "number",
      )
    ) {
      return translateDashboardText(node.join(""), locale);
    }
    return node.map((child) => translateNode(child, locale));
  }
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  const props = element.props;
  if (props["data-no-dashboard-translate"] !== undefined) return node;
  const preserveChildren =
    typeof element.type === "string" && untranslatedElements.has(element.type);

  const translated: Record<string, unknown> = {};
  for (const attribute of [
    "aria-label",
    "ariaLabel",
    "placeholder",
    "title",
    "confirmation",
  ] as const) {
    if (typeof props[attribute] === "string")
      translated[attribute] = translateDashboardText(props[attribute], locale);
  }
  if (props.options)
    translated.options = translateOptions(props.options, locale);
  if (props["data-dashboard-shell"] !== undefined)
    translated.dir = locale === "ar" ? "rtl" : "ltr";

  if (props.children === undefined || preserveChildren)
    return cloneElement(element, translated);
  const translatedChildren = translateNode(props.children as ReactNode, locale);
  return Array.isArray(translatedChildren)
    ? cloneElement(element, translated, ...translatedChildren)
    : cloneElement(element, translated, translatedChildren);
}

export function DashboardLocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: DashboardLocaleValue;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const t = useCallback(
    (text: string) => translateDashboardText(text, locale),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const selectLocale = useCallback(
    (next: DashboardLocaleValue) => {
      document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      window.localStorage.setItem(localeCookie, next);
      setLocale(next);
      window.location.reload();
    },
    [],
  );

  const context = useMemo(
    () => ({ locale, selectLocale, t }),
    [locale, selectLocale, t],
  );
  return (
    <DashboardLocaleContext.Provider value={context}>
      {children}
    </DashboardLocaleContext.Provider>
  );
}

export function useDashboardLocale() {
  const context = useContext(DashboardLocaleContext);
  if (!context)
    throw new Error(
      "Dashboard locale controls must be rendered inside DashboardLocaleProvider.",
    );
  return context;
}

export function DashboardTranslated({ children }: { children: ReactNode }) {
  const { locale } = useDashboardLocale();
  const translated = useMemo(
    () => translateNode(children, locale),
    [children, locale],
  );
  return Array.isArray(translated)
    ? cloneElement(<></>, undefined, ...translated)
    : translated;
}

export function DashboardLocale() {
  const { locale, selectLocale } = useDashboardLocale();
  return (
    <div
      data-no-dashboard-translate
      className="inline-flex items-center gap-1 rounded-full border border-[#D8D1F3] bg-[#F5F2FF] p-1"
      role="group"
      aria-label={
        locale === "ar" ? "تغيير لغة لوحة التحكم" : "Switch dashboard language"
      }
    >
      <Languages
        className="mx-1 h-3.5 w-3.5 text-[#5B2EFF]"
        aria-hidden="true"
      />
      {(["en", "ar"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => selectLocale(option)}
          aria-pressed={locale === option}
          aria-label={option === "en" ? "English" : "العربية"}
          className={`min-w-10 rounded-full px-2.5 py-1.5 text-xs font-bold transition ${locale === option ? "bg-[#5B2EFF] text-white shadow-sm" : "text-[#5C6272] hover:bg-white hover:text-[#5B2EFF]"}`}
        >
          {option === "en" ? "EN" : "ع"}
        </button>
      ))}
    </div>
  );
}
