import type { StorefrontLocale } from "@/lib/types";

const welcomeTemplates: Record<StorefrontLocale, string> = {
  en: "Hi - I'm the Maison Vert product assistant. You're viewing {product}. Ask me about fit, sizing, materials, care, colors, or gift suitability.",
  ar: "مرحبًا، أنا مساعد Maison Vert للمنتجات. أنت تشاهد {product}. أقدر أساعدك بالمقاس، اللون، الخامة، العناية، أو مناسبته كهدية.",
};

export function buildAgentWelcomeMessage(productName: string, locale: StorefrontLocale = "en") {
  return welcomeTemplates[locale].replaceAll("{product}", productName);
}
