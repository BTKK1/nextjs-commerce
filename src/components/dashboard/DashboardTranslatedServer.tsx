import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { getDashboardLocale, type DashboardLocale } from "@/lib/dashboard/i18n";
import { translateDashboardText } from "@/lib/dashboard/translations";

const untranslatedElements = new Set([
  "textarea",
  "pre",
  "code",
  "script",
  "style",
]);

function translateOptions(value: unknown, locale: DashboardLocale): unknown {
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

function translateNode(node: ReactNode, locale: DashboardLocale): ReactNode {
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
  if (props.children === undefined || preserveChildren)
    return cloneElement(element, translated);
  const translatedChildren = translateNode(props.children as ReactNode, locale);
  return Array.isArray(translatedChildren)
    ? cloneElement(element, translated, ...translatedChildren)
    : cloneElement(element, translated, translatedChildren);
}

export async function DashboardTranslatedServer({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getDashboardLocale();
  return translateNode(children, locale);
}
