import type { StorefrontLocale } from "@/lib/types";

export type AgentTonePreset = "neutral_saudi" | "warm_concise" | "consultative";
export type ArabicDialect = "white_saudi" | "najdi" | "hijazi" | "gulf" | "modern_standard";

export const DEFAULT_AGENT_TONE: AgentTonePreset = "neutral_saudi";
export const DEFAULT_ARABIC_DIALECT: ArabicDialect = "white_saudi";

const englishTemplates: Record<AgentTonePreset, string> = {
  neutral_saudi: "Hi, I’m Nbeh. Ask me anything about {product} and I’ll help you decide if it fits what you need.",
  warm_concise: "Hi! I’m Nbeh 👋 Curious about {product}? Ask me anything and I’ll help you decide.",
  consultative: "Hi, I’m Nbeh. Tell me what matters to you about {product}, and I’ll help you work out whether it’s the right fit.",
};

const arabicTemplates: Record<ArabicDialect, Record<AgentTonePreset, string>> = {
  white_saudi: {
    neutral_saudi: "هلا! أنا نبيه. اسألني عن {product} وبساعدك تعرف إذا يناسبك.",
    warm_concise: "هلا والله 👋 أنا نبيه. ودك تعرف عن {product}؟ اسألني وبساعدك بسرعة.",
    consultative: "هلا، أنا نبيه. قل لي وش يهمك في {product} وبساعدك تعرف إذا هو الأنسب لك.",
  },
  najdi: {
    neutral_saudi: "هلا والله! أنا نبيه. اسألني عن {product} وأبشر أساعدك تعرف إذا يناسبك.",
    warm_concise: "يا هلا 👋 أنا نبيه. ودك تعرف عن {product}؟ أبشر باللي يفيدك.",
    consultative: "يا هلا، أنا نبيه. علّمني وش يهمك في {product} وأساعدك تعرف إذا هو الأنسب لك.",
  },
  hijazi: {
    neutral_saudi: "أهلين! أنا نبيه. اسألني عن {product} وأساعدك تعرف إذا يناسبك.",
    warm_concise: "أهلين وسهلين 👋 أنا نبيه. حاب تعرف عن {product}؟ اسألني.",
    consultative: "أهلين، أنا نبيه. قل لي إيش يهمك في {product} وأساعدك تعرف إذا يناسب احتياجك.",
  },
  gulf: {
    neutral_saudi: "هلا بك! أنا نبيه. اسألني عن {product} وبساعدك تشوف إذا يناسبك.",
    warm_concise: "هلا وغلا 👋 أنا نبيه. تبي تعرف عن {product}؟ اسألني.",
    consultative: "هلا بك، أنا نبيه. خبرني شنو يهمك في {product} وبساعدك تعرف إذا يناسبك.",
  },
  modern_standard: {
    neutral_saudi: "مرحبًا، أنا نبيه. اسألني عن {product} وسأساعدك في معرفة ما إذا كان مناسبًا لك.",
    warm_concise: "مرحبًا 👋 أنا نبيه. هل تريد معرفة المزيد عن {product}؟ اسألني.",
    consultative: "مرحبًا، أنا نبيه. أخبرني بما يهمك في {product} وسأساعدك في معرفة مدى ملاءمته لاحتياجك.",
  },
};

export function normalizeAgentTone(value: unknown): AgentTonePreset {
  return value === "warm_concise" || value === "consultative" || value === "neutral_saudi" ? value : DEFAULT_AGENT_TONE;
}

export function normalizeArabicDialect(value: unknown): ArabicDialect {
  const normalized = String(value ?? "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized.includes("najdi")) return "najdi";
  if (normalized.includes("hijazi") || normalized.includes("hejazi")) return "hijazi";
  if (normalized === "gulf" || normalized.includes("khaleeji")) return "gulf";
  if (normalized.includes("modern_standard") || normalized === "msa" || normalized.includes("fusha")) return "modern_standard";
  return DEFAULT_ARABIC_DIALECT;
}

export function buildAgentWelcomeMessage(
  productName: string,
  locale: StorefrontLocale = "en",
  _merchantName = locale === "ar" ? "المتجر" : "store",
  options: { tonePreset?: unknown; arabicDialect?: unknown } = {},
) {
  const product = productName.trim();
  const tone = normalizeAgentTone(options.tonePreset);
  const template = locale === "ar"
    ? arabicTemplates[normalizeArabicDialect(options.arabicDialect)][tone]
    : englishTemplates[tone];
  return template.replaceAll("{product}", product);
}
