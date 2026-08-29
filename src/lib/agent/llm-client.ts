import { getModelConfig, PRODUCT_AGENT_PROMPT_VERSION, type ProductAgentProvider, type ProductAgentRoute } from "@/lib/ai/model-config";
import { buildAgentSystemPrompt } from "@/lib/agent/prompt-builder";
import { evaluateOutputGuardrails } from "@/lib/agent/guardrails";
import { detectLanguage, fallbackText } from "@/lib/agent/language";
import { detectObjection } from "@/lib/insights/extractor";
import type { SellerKnowledgeContext } from "@/lib/knowledge/seller-knowledge";
import type { AgentAnswer, AgentConversationTurn, AgentPageContext, DemoProduct, ObjectionCategory } from "@/lib/types";
import type { RuntimeAgentConfig } from "@/lib/agent/config-repository";
import { estimateModelCostUsd } from "@/lib/ai/model-pricing";
import { formatProductPrice } from "@/data/catalog";

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    total_cost?: number;
  };
}

interface ProviderCallResult {
  ok: boolean;
  text: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  httpStatus: number | null;
}

interface AttemptRecord {
  provider: ProductAgentProvider;
  model: string;
  ok: boolean;
  errorCode: string | null;
  latencyMs: number;
}

function providerKey(provider: ProductAgentProvider, config: ReturnType<typeof getModelConfig>): string | undefined {
  return provider === "deepseek-direct" ? config.deepseekApiKey : config.apiKey;
}

function providerBaseUrl(provider: ProductAgentProvider): string {
  return provider === "deepseek-direct" ? "https://api.deepseek.com/v1" : "https://openrouter.ai/api/v1";
}

function classifyHttp(status: number, body: string): string {
  if (status === 401 || status === 403) return "auth_error";
  if (status === 402) return "no_credits";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_error";
  if (/credit|quota|balance/i.test(body)) return "no_credits";
  return "http_error";
}

function routeLabel(attempts: AttemptRecord[]): string {
  return attempts.map((attempt) => `${attempt.provider}(${attempt.ok ? "ok" : attempt.errorCode ?? "failed"})`).join("->");
}

function timeoutMs(): number {
  const value = Number(process.env.PRODUCT_AGENT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 30_000;
}

function sameRouteRetries(): number {
  const value = Number(process.env.PRODUCT_AGENT_SAME_ROUTE_RETRIES);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(5, Math.floor(value));
}

function retryBaseMs(): number {
  const value = Number(process.env.PRODUCT_AGENT_RETRY_BASE_MS);
  return Number.isFinite(value) && value >= 0 ? Math.min(30_000, value) : 2_000;
}

function isTransientProviderFailure(result: ProviderCallResult): boolean {
  return result.errorCode === "rate_limited"
    || result.errorCode === "timeout"
    || result.errorCode === "provider_error";
}

function waitForRetry(attempt: number): Promise<void> {
  const delay = retryBaseMs() * (2 ** attempt);
  return delay > 0 ? new Promise((resolve) => setTimeout(resolve, delay)) : Promise.resolve();
}

function includesNormalized(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle.toLowerCase());
}

function hasArabic(value: string): boolean {
  return /[\u0600-\u06ff]/.test(value);
}

function currentTurnLanguageInstruction(message: string): string {
  return detectLanguage(message) === "ar"
    ? "Mandatory current-turn language: Reply in natural white Saudi Arabic. Do not answer this turn in English."
    : "Mandatory current-turn language: Reply in concise, natural English. Do not answer this turn in Arabic.";
}

function normalizeComparableAnswer(value: string): string {
  return normalizeDigits(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

type LimitUnit = "inch" | "cm" | "kg" | "liter";

interface VerifiedLimitMismatch {
  requested: number;
  maximum: number;
  unit: LimitUnit;
}

const measurementPattern = "inches?|inch|in\\.?|إنش|انش|بوص(?:ة|ات)|cm|centimet(?:er|re)s?|سم|kg|kilograms?|كجم|كيلو(?:غرام)?|liters?|litres?|لتر";

function canonicalLimitUnit(value: string): LimitUnit | null {
  const normalized = value.toLowerCase().replace(/\./g, "");
  if (/^(?:inches?|inch|in|إنش|انش|بوص(?:ة|ات))$/.test(normalized)) return "inch";
  if (/^(?:cm|centimet(?:er|re)s?|سم)$/.test(normalized)) return "cm";
  if (/^(?:kg|kilograms?|كجم|كيلو(?:غرام)?)$/.test(normalized)) return "kg";
  if (/^(?:liters?|litres?|لتر)$/.test(normalized)) return "liter";
  return null;
}

function productLimitText(product: DemoProduct): string {
  return normalizeDigits([
    product.shortDescription,
    product.longDescription,
    ...product.keyFeatures,
    ...(product.sizeGuide ?? []).flatMap((item) => [item.label, item.value]),
    ...product.specs.flatMap((item) => [item.label, item.value]),
    ...product.faqs.flatMap((item) => [item.question, item.answer]),
  ].join(" "));
}

function findVerifiedLimitMismatch(product: DemoProduct, message: string): VerifiedLimitMismatch | null {
  const normalizedMessage = normalizeDigits(message);
  if (!/\b(?:fit|fits|fitting|accommodate|hold|compatible|suitable|work with|take)\b|يناسب|تناسب|يكفي|يتسع|يدخل|يركب/i.test(normalizedMessage)) {
    return null;
  }

  const requestedMeasurements = [...normalizedMessage.matchAll(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:[-–—]\\s*)?(${measurementPattern})`, "giu"))]
    .map((match) => ({ value: Number(match[1].replace(",", ".")), unit: canonicalLimitUnit(match[2]) }))
    .filter((item): item is { value: number; unit: LimitUnit } => Number.isFinite(item.value) && item.unit !== null);
  if (!requestedMeasurements.length) return null;

  const limits = [...productLimitText(product).matchAll(new RegExp(`(?:up to|maximum(?:\\s+capacity)?(?:\\s+of)?|max(?:imum)?(?:\\s+of)?|حتى|بحد أقصى)\\s+(?:a|an)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:[-–—]\\s*)?(${measurementPattern})`, "giu"))]
    .map((match) => ({ value: Number(match[1].replace(",", ".")), unit: canonicalLimitUnit(match[2]) }))
    .filter((item): item is { value: number; unit: LimitUnit } => Number.isFinite(item.value) && item.unit !== null);

  for (const requested of requestedMeasurements) {
    const matchingLimits = limits.filter((limit) => limit.unit === requested.unit).map((limit) => limit.value);
    if (!matchingLimits.length) continue;
    const maximum = Math.max(...matchingLimits);
    if (requested.value > maximum) return { requested: requested.value, maximum, unit: requested.unit };
  }
  return null;
}

function startsWithExplicitRejection(answer: string): boolean {
  return /^\s*(?:no\b|nope\b|it\s+(?:will|does|would|can)(?:\s+not|n't)\b|this\s+(?:will|does|would|can)(?:\s+not|n't)\b|لا\b|ما\s+(?:يناسب|يكفي|يتسع|يدخل|يركب)\b|مو\s+(?:مناسب|كافي)\b)/i.test(answer);
}

function answerStatesVerifiedLimit(answer: string, mismatch: VerifiedLimitMismatch): boolean {
  const normalized = normalizeDigits(answer);
  if (!new RegExp(`(^|[^0-9])${String(mismatch.maximum).replace(".", "\\.")}([^0-9]|$)`).test(normalized)) return false;
  const unitPatterns: Record<LimitUnit, RegExp> = {
    inch: /inches?|inch|\bin\.?\b|إنش|انش|بوص(?:ة|ات)/i,
    cm: /\bcm\b|centimet(?:er|re)s?|سم/i,
    kg: /\bkg\b|kilograms?|كجم|كيلو(?:غرام)?/i,
    liter: /liters?|litres?|لتر/i,
  };
  return unitPatterns[mismatch.unit].test(normalized);
}

function hasDirectVerifiedMismatchAnswer(answer: string, mismatch: VerifiedLimitMismatch): boolean {
  return startsWithExplicitRejection(answer) && answerStatesVerifiedLimit(answer, mismatch);
}

function formatLimitValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function deterministicLimitMismatchAnswer(mismatch: VerifiedLimitMismatch, language: "ar" | "en"): string {
  const maximum = formatLimitValue(mismatch.maximum);
  const requested = formatLimitValue(mismatch.requested);
  if (language === "ar") {
    const unit = mismatch.unit === "inch" ? "إنش" : mismatch.unit === "liter" ? "لتر" : mismatch.unit;
    return `لا، الحد الموثق للمنتج حتى ${maximum} ${unit}، لذلك ما يناسب متطلبك ${requested} ${unit}.`;
  }
  const unit = mismatch.unit === "inch" ? (mismatch.maximum === 1 ? "inch" : "inches") : mismatch.unit === "liter" ? "liters" : mismatch.unit;
  return `No—the product's verified maximum is ${maximum} ${unit}, below your ${requested} ${unit} requirement.`;
}

/**
 * Detects when a model has effectively sent the shopper the same answer twice.
 * The threshold deliberately ignores very short acknowledgements so normal
 * conversational words such as "yes" do not trigger an unnecessary LLM call.
 */
export function areAgentAnswersNearDuplicates(candidate: string, previous: string): boolean {
  const left = normalizeComparableAnswer(candidate);
  const right = normalizeComparableAnswer(previous);
  if (!left || !right) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 24) return false;

  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 1));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 1));
  if (Math.min(leftTokens.size, rightTokens.size) < 5) return false;
  let shared = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1;
  const dice = (2 * shared) / (leftTokens.size + rightTokens.size);
  const containment = shared / Math.min(leftTokens.size, rightTokens.size);
  const lengthRatio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
  return dice >= 0.82 || (containment >= 0.9 && lengthRatio >= 0.68);
}

function latestAssistantAnswer(history: AgentConversationTurn[]): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === "assistant" && history[index].content.trim()) return history[index].content.trim();
  }
  return null;
}

function buildGroundingRepairMessage(
  product: DemoProduct,
  originalMessage: string,
  previousAnswer: string,
  repeatedAnswer?: string | null,
): string {
  const sizeVariant = product.variants.find((variant) => /size/i.test(variant.name));
  const colorVariant = product.variants.find((variant) => /color/i.test(variant.name));
  const firstSizeValue = sizeVariant?.values[0];
  const firstColorValue = colorVariant?.values[0];
  const sizeGuideValue = product.sizeGuide?.[0]?.value;
  const limitMismatch = findVerifiedLimitMismatch(product, originalMessage);
  const asksGiftSuitability = /gift|present|هدية|هديه|أهدي|اهدي/.test(originalMessage.toLowerCase());
  const priceOrValueQuestion = asksAboutPriceOrValue(originalMessage);

  return [
    "Revise the assistant answer for the shopper's original message.",
    "Use only the Product and catalog context from the system prompt.",
    `Original shopper message: ${originalMessage}`,
    `Previous weak answer: ${previousAnswer}`,
    priceOrValueQuestion
      ? `The shopper asked about price or value. State the exact listed price and currency (${formatPriceForRepair(product)}). If this is a price objection, acknowledge it once, use verified value facts, and give one low-pressure decision aid.`
      : null,
    asksGiftSuitability
      ? `The shopper asked about gift suitability. Answer suitability directly and use verified gift evidence such as material "${product.material ?? "not listed"}", key feature "${product.keyFeatures[0] ?? "not listed"}", or the merchant-approved gift answer. Do not mark suitability unknown merely because gift packaging is not listed; mention packaging only if the shopper asked about it.`
      : null,
    limitMismatch
      ? `The shopper's ${formatLimitValue(limitMismatch.requested)} ${limitMismatch.unit} requirement exceeds the verified ${formatLimitValue(limitMismatch.maximum)} ${limitMismatch.unit} maximum. Begin with an explicit "No" (or "لا" in Arabic), state the exact verified maximum, and do not imply suitability.`
      : null,
    repeatedAnswer ? `The immediately preceding assistant answer was: ${repeatedAnswer}` : null,
    repeatedAnswer
      ? "The draft repeats that earlier answer. Answer the shopper's latest follow-up specifically, preserve relevant history, and use materially different wording."
      : null,
    "Return only the revised customer-facing answer.",
    "Keep the revised answer to one or two short conversational lines unless a little more detail is genuinely needed.",
    "Do not use Markdown formatting, bold text, or labels such as Catalog-backed detail.",
    `Current product identity: ${product.name}. Mention it only when it helps clarity; do not repeat it mechanically.`,
    `Required visible price if price is relevant: ${formatPriceForRepair(product)}`,
    sizeVariant ? `If size or fit is relevant, include the exact variant label "${sizeVariant.name}".` : null,
    firstSizeValue ? `If size or fit is relevant, include at least one exact size value such as "${firstSizeValue}".` : null,
    sizeGuideValue ? `If fit measurements are relevant, include the exact size guide wording "${sizeGuideValue}".` : null,
    colorVariant ? `If color is relevant, include the exact variant label "${colorVariant.name}".` : null,
    firstColorValue ? `If color is relevant, include at least one exact color value such as "${firstColorValue}".` : null,
    "If the original shopper wrote Arabic, answer in natural white Saudi Arabic. Include the exact English product name only when it is needed to identify the product clearly.",
    "Do not invent discounts, delivery dates, warranties, certifications, or unsupported claims.",
    "Do not force a question, call to action, or product-page next step."
  ]
    .filter(Boolean)
    .join("\n");
}

function formatPriceForRepair(product: DemoProduct): string {
  return formatProductPrice(product);
}

function asksAboutPriceOrValue(message: string): boolean {
  return /price|cost|worth|value|expensive|cheaper|budget|سعر|بكم|تكلفة|يستاهل|يسوى|غالي|أرخص|ارخص|ميزاني/.test(message.toLowerCase());
}

function asksAboutPhysicalSizing(message: string): boolean {
  return /\b(size|sizing|sized|chest|waist|inseam|measurements?)\b|مقاس|مقاسات|قياس|قياسات|صدر|خصر|طول/.test(message.toLowerCase());
}

function mentionsExactCatalogPrice(answer: string, product: DemoProduct): boolean {
  const normalized = normalizeDigits(answer).toLowerCase();
  const amount = String(product.priceSar).replace(".", "\\.");
  if (!new RegExp(`(^|[^0-9])${amount}([^0-9]|$)`).test(normalized)) return false;
  const currency = (product.currency ?? "USD").toUpperCase();
  if (currency === "USD") return /\$|\busd\b|\bdollars?\b|دولار/.test(normalized);
  if (currency === "SAR") return /\bsar\b|ر\.?\s?س|ريال|﷼/.test(normalized);
  return new RegExp(`\\b${currency.toLowerCase()}\\b`).test(normalized)
    || normalizeComparableAnswer(answer).includes(normalizeComparableAnswer(formatProductPrice(product)));
}

function deterministicPriceGroundedAnswer(
  product: DemoProduct,
  message: string,
  previousAnswer: string,
  language: "ar" | "en",
): string {
  const price = formatPriceForRepair(product);
  const isPriceObjection = detectObjection(message) === "price_concern";

  if (!isPriceObjection) {
    return cleanCustomerFacingText(
      language === "ar"
        ? `سعره ${price}. ${previousAnswer}`
        : `It's ${price}. ${previousAnswer}`,
    );
  }

  if (language === "ar") {
    const groundedAnswer = hasArabic(previousAnswer) ? previousAnswer : "";
    return cleanCustomerFacingText(
      `أتفهم إن السعر يفرق، وسعره ${price}. ${groundedAnswer} إذا هذي التفاصيل مو مهمة لك، ممكن ما يكون الأنسب.`,
    );
  }

  const approvedValueAnswer = product.objections.find((item) => item.category === "price_concern")?.response.trim();
  const groundedValueAnswer = approvedValueAnswer
    || (product.keyFeatures[0] ? `The catalog highlights ${product.keyFeatures[0]}.` : previousAnswer);
  return cleanCustomerFacingText(
    `I get why it feels expensive at ${price}. ${groundedValueAnswer} If those details are not priorities for you, it may not be the right buy.`,
  );
}

function acknowledgesObjection(answer: string, objection: ObjectionCategory, language: "ar" | "en"): boolean {
  const common = language === "ar" ? /فاهم|أتفهم|افهم|تردد|قلق|محتار/ : /\bI get\b|\bI understand\b|concern|hesitation|not sure/i;
  if (common.test(answer)) return true;
  const patterns: Record<ObjectionCategory, RegExp> = {
    price_concern: language === "ar" ? /غالي|السعر|سعره/ : /expensive|price/i,
    quality_concern: language === "ar" ? /الجودة|جوده|الخامة|خامه/ : /quality/i,
    shipping_concern: language === "ar" ? /الشحن|التوصيل/ : /shipping|delivery/i,
    gift_concern: language === "ar" ? /هدية|هديه/ : /gift|present/i,
    suitability_concern: language === "ar" ? /مناسب|يناسب|استخدامك/ : /fit|suitable|your use/i,
    variant_confusion: language === "ar" ? /محتار|الخيار|المقاس|اللون/ : /choice|option|size|color|variant/i,
    maintenance_concern: language === "ar" ? /العناية|عنايه|التنظيف/ : /care|clean|maintenance/i,
  };
  return patterns[objection].test(answer);
}

function providesDecisionHelp(answer: string): boolean {
  return /\b(because|if you|for your|fits?|suitable|trade[- ]?off|however|but|depends|i(?:'d| would) (?:pick|choose|recommend)|better for)\b|لأن|لان|إذا|لو |على استخدامك|مناسب|أنسب|أميل|لكن|يعتمد|الفرق/i.test(answer);
}

function deterministicObjectionGuidance(
  product: DemoProduct,
  message: string,
  previousAnswer: string,
  language: "ar" | "en",
  objection: ObjectionCategory,
): string {
  if (objection === "price_concern") {
    return deterministicPriceGroundedAnswer(product, message, previousAnswer, language);
  }

  if (language === "ar") {
    const acknowledgement = objection === "quality_concern" ? "فاهم قلقك من الجودة." : "فاهم ترددك.";
    return cleanCustomerFacingText(
      `${acknowledgement} ${previousAnswer} إذا هذي التفاصيل هي اللي تهمك، أشوفه مناسب؛ غير كذا ما راح أضغط عليك.`,
    );
  }

  const acknowledgement = objection === "quality_concern" ? "I get the quality concern." : "I get the hesitation.";
  return cleanCustomerFacingText(
    `${acknowledgement} ${previousAnswer} If those verified details are your priority, it is a reasonable fit; otherwise I would not push it.`,
  );
}

function needsCatalogGroundingRetry(
  product: DemoProduct,
  message: string,
  text: string,
  knowledge?: SellerKnowledgeContext,
): boolean {
  const cleanText = text.trim();
  const normalizedMessage = message.toLowerCase();
  const tokenCount = cleanText.split(/\s+/).filter(Boolean).length;
  const language = detectLanguage(message);
  const asksPrice = asksAboutPriceOrValue(normalizedMessage);
  const asksVariantList = /what variants|which variants|options do you have|available options|what options|خيارات|مقاسات|ألوان|الوان/.test(normalizedMessage);
  const asksComparison = /compare|related product|related item|compare this with|فرق|قارن|مقارنة|المنتج الثاني/.test(normalizedMessage);
  const asksShipping = /ship|shipping|delivery|deliver|return|returns|شحن|توصيل|يوصل|إرجاع|ارجاع/.test(normalizedMessage);
  const asksSize = asksAboutPhysicalSizing(normalizedMessage);
  const asksWarmthOrMaterial = /warm|winter|cold|material|fabric|quality|جودة|خامة|خامات|دافي|شتاء|برد/.test(normalizedMessage);
  const limitMismatch = findVerifiedLimitMismatch(product, message);
  const primaryRelatedName = knowledge?.relatedProducts[0]?.name;
  const requiresComplimentaryShipping = /complimentary shipping/i.test(product.careShippingNotes);
  const requiresReturns = /returns?/i.test(product.careShippingNotes);
  const sizeVariant = product.variants.find((variant) => /size/i.test(variant.name));
  const colorVariant = product.variants.find((variant) => /color/i.test(variant.name));
  const firstSizeValue = sizeVariant?.values[0];
  const firstSizeGuideValue = product.sizeGuide?.[0]?.value;
  const requiredMaterialWords = (product.material?.match(/[A-Za-z]+/g) ?? [])
    .filter((word) => word.length > 3)
    .slice(0, 2);

  if (cleanText.length < 5 || tokenCount < 1) return true;
  if (language === "ar" && !hasArabic(cleanText)) return true;
  if (limitMismatch && !hasDirectVerifiedMismatchAnswer(cleanText, limitMismatch)) return true;
  if (asksPrice && !mentionsExactCatalogPrice(cleanText, product)) return true;
  if (asksVariantList && [...(sizeVariant?.values ?? []), ...(colorVariant?.values ?? [])].length > 0
    && ![...(sizeVariant?.values ?? []), ...(colorVariant?.values ?? [])].some((value) => includesNormalized(cleanText, value))) return true;
  if (language === "en" && asksShipping && requiresComplimentaryShipping && !includesNormalized(cleanText, "shipping")) return true;
  if (language === "en" && asksShipping && requiresReturns && !includesNormalized(cleanText, "return")) return true;
  if (asksSize && firstSizeValue && language === "en" && !includesNormalized(cleanText, firstSizeValue)) return true;
  if (language === "en" && asksSize && firstSizeGuideValue && /chest/i.test(firstSizeGuideValue) && !includesNormalized(cleanText, "Chest")) return true;
  if (language === "en" && asksWarmthOrMaterial && requiredMaterialWords.length > 0 && !requiredMaterialWords.some((word) => includesNormalized(cleanText, word))) return true;
  if (asksComparison && primaryRelatedName && !includesNormalized(cleanText, primaryRelatedName)) return true;
  return false;
}

function estimateTextTokens(value: string): number {
  if (!value) return 0;
  return Math.max(1, Math.ceil(new TextEncoder().encode(value).byteLength / 4));
}

/**
 * Reserves enough wallet capacity for the normal answer plus the single repair
 * pass used for grounding or repetition. Settlement still charges only the
 * provider-reported usage.
 */
export function estimateAgentTokenReservation(
  product: DemoProduct,
  message: string,
  pageContext?: AgentPageContext,
  knowledge?: SellerKnowledgeContext,
  conversationHistory: AgentConversationTurn[] = [],
  runtimeConfig?: RuntimeAgentConfig,
): number {
  const systemPrompt = buildAgentSystemPrompt(product, pageContext, knowledge, runtimeConfig);
  const maxOutputTokens = Math.max(1, runtimeConfig?.maxTokens ?? 420);
  const historyTokens = conversationHistory.reduce((sum, turn) => sum + estimateTextTokens(turn.content) + 4, 0);
  const baseInputTokens = estimateTextTokens(systemPrompt)
    + historyTokens
    + estimateTextTokens(currentTurnLanguageInstruction(message))
    + estimateTextTokens(message)
    + 16;
  const repairInstructionTokens = estimateTextTokens(message)
    + maxOutputTokens
    + estimateTextTokens(formatPriceForRepair(product))
    + 320;
  const repairInputTokens = estimateTextTokens(systemPrompt) + historyTokens + repairInstructionTokens + 16;
  return Math.ceil((baseInputTokens + maxOutputTokens + repairInputTokens + maxOutputTokens) * 1.08);
}

function cleanCustomerFacingText(text: string): string {
  const cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^catalog-backed detail:.*$/gim, "")
    .replace(/^\s*(?:(?:welcome|hi|hello|hey)(?:\s+there)?|(?:أهل(?:ًا|اً|ا|ين)?|اهل(?:ا|ين)?|مرحب(?:ًا|اً|ا)?|هلا(?:\s+والله)?|حياك)(?:\s+بك)?)\s*[!،,.:—–-]*\s*/i, "")
    .replace(/(?<![\p{L}\p{N}_])كتن(?![\p{L}\p{N}_])/gu, "كتان")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= 600) return cleaned;

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const compact = paragraphs.slice(0, 2).join("\n\n").trim();
  if (compact && compact.length <= 600) return compact;

  const sentences = (compact || cleaned).match(/[^.!?؟]+[.!?؟]+|[^.!?؟]+$/g) ?? [];
  let shortened = "";
  for (const sentence of sentences.slice(0, 3)) {
    const candidate = `${shortened}${shortened ? " " : ""}${sentence.trim()}`;
    if (candidate.length > 580) break;
    shortened = candidate;
  }
  if (shortened) return shortened;
  return `${(compact || cleaned).slice(0, 560).replace(/\s+\S*$/, "").trim()}…`;
}

/**
 * Keep a useful model answer when it asks more than one follow-up. Nbeh's
 * product policy allows one question, so join earlier question clauses into
 * the final question instead of replacing the entire answer with a fallback.
 */
export function limitAnswerToOneQuestion(text: string, language: "ar" | "en"): string {
  const questionMarks = [...text.matchAll(/[؟?]/g)];
  if (questionMarks.length <= 1) return text;
  const finalQuestionIndex = questionMarks.at(-1)?.index ?? -1;
  const separator = language === "ar" ? "،" : ",";
  return text
    .replace(/[؟?]/g, (character, offset) => offset === finalQuestionIndex ? character : separator)
    .replace(/\s+([،,])/g, "$1");
}

function isDirectPurchaseIntent(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const englishIntent = /\b(?:i\s+(?:want|need|would\s+like|am\s+ready|'m\s+ready)\s+to\s+(?:buy|purchase|order)|(?:how|where)\s+(?:can|do)\s+i\s+(?:buy|purchase|order)|(?:buy|purchase|order|checkout)(?:\s+(?:it|this|now))?)\b[.!?]*$/.test(normalized);
  const arabicIntent = /(?:أ|ا)?بي\s+(?:أ|ا)?شتري|(?:أ|ا)?بغى\s+(?:أ|ا)?شتري|(?:أ|ا)?ريد\s+(?:أ|ا)?شتري/.test(normalized);
  return englishIntent || arabicIntent;
}

function deterministicPurchaseIntentAnswer(product: DemoProduct, language: "ar" | "en"): string {
  if (language === "ar") {
    return `تمام، إذا ${product.arabicName || product.name} مناسب لك اختَر الخيار اللي يناسبك من الصفحة واضغط إضافة للسلة لإكمال الطلب.`;
  }
  return `If ${product.name} suits you, choose your preferred option on the product page and use Add to cart to continue.`;
}

function deterministicTestProviderAnswer(product: DemoProduct, message: string, language: "ar" | "en"): AgentAnswer {
  const price = formatPriceForRepair(product);
  const verifiedFact = product.material || product.keyFeatures[0] || product.shortDescription;
  let text = language === "ar"
    ? `${product.arabicName || product.name}: ${verifiedFact}`
    : `${product.name}: ${verifiedFact}`;
  if (asksAboutPriceOrValue(message)) {
    text = language === "ar" ? `سعره ${price}.` : `It's ${price}.`;
  } else {
    const objection = detectObjection(message);
    if (objection) text = deterministicObjectionGuidance(product, message, text, language, objection);
  }
  return {
    text: cleanCustomerFacingText(text),
    detectedObjection: detectObjection(message),
    confidence: 0.95,
    mode: "live",
    language,
    provider: "openrouter",
    model: "deterministic-test-provider",
    providerRoute: "deterministic-test-provider(ok)",
    promptVersion: PRODUCT_AGENT_PROMPT_VERSION,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    latencyMs: 0,
    errorCode: null,
    errorMessage: null,
  };
}

async function callProvider(
  route: ProductAgentRoute,
  product: DemoProduct,
  message: string,
  pageContext?: AgentPageContext,
  knowledge?: SellerKnowledgeContext,
  conversationHistory: AgentConversationTurn[] = [],
  runtimeConfig?: RuntimeAgentConfig,
  languageSourceMessage: string = message,
): Promise<ProviderCallResult> {
  const config = getModelConfig();
  const key = providerKey(route.provider, config);
  const started = performance.now();
  const fail = (errorCode: string, errorMessage: string, httpStatus: number | null = null): ProviderCallResult => ({
    ok: false,
    text: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    estimatedCost: null,
    latencyMs: Math.round(performance.now() - started),
    errorCode,
    errorMessage,
    httpStatus
  });

  if (!key) return fail("not_configured", `${route.provider} is not configured`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    };

    if (route.provider === "openrouter") {
      headers["HTTP-Referer"] = config.siteUrl || "http://localhost:3000";
      headers["X-Title"] = config.appName || "Nbeh AI";
    }

    const response = await fetch(`${providerBaseUrl(route.provider)}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model: route.model,
        ...(route.provider === "openrouter" && route.model === "z-ai/glm-5.3-flash"
          ? { reasoning: { effort: "low", exclude: true } }
          : {}),
        temperature: runtimeConfig?.temperature ?? 0.25,
        max_tokens: runtimeConfig?.maxTokens ?? 420,
        messages: [
          { role: "system", content: buildAgentSystemPrompt(product, pageContext, knowledge, runtimeConfig) },
          ...conversationHistory,
          { role: "system", content: currentTurnLanguageInstruction(languageSourceMessage) },
          { role: "user", content: message }
        ]
      })
    });

    const raw = await response.text();
    if (!response.ok) {
      return fail(classifyHttp(response.status, raw), `HTTP ${response.status}: ${raw.slice(0, 240)}`, response.status);
    }

    let payload: OpenRouterResponse;
    try {
      payload = JSON.parse(raw) as OpenRouterResponse;
    } catch {
      return fail("invalid_response", `${route.provider} returned non-JSON`, response.status);
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return fail("invalid_response", `${route.provider} returned an empty assistant message`, response.status);
    }

    const promptTokens = payload.usage?.prompt_tokens ?? null;
    const completionTokens = payload.usage?.completion_tokens ?? null;
    const totalTokens = payload.usage?.total_tokens ?? (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);
    const reportedCost = payload.usage?.cost ?? payload.usage?.total_cost ?? null;

    return {
      ok: true,
      text,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: reportedCost != null ? Number(reportedCost) : estimateModelCostUsd(route.model, promptTokens, completionTokens),
      latencyMs: Math.round(performance.now() - started),
      errorCode: null,
      errorMessage: null,
      httpStatus: response.status
    };
  } catch (error) {
    const failure = error instanceof Error && error.name === "AbortError"
      ? fail("timeout", `Request timed out after ${timeoutMs()}ms`)
      : fail("provider_error", error instanceof Error ? error.message : "Network error");
    return failure;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateAgentAnswer(
  product: DemoProduct,
  message: string,
  pageContext?: AgentPageContext,
  knowledge?: SellerKnowledgeContext,
  conversationHistory: AgentConversationTurn[] = [],
  runtimeConfig?: RuntimeAgentConfig,
): Promise<AgentAnswer> {
  const config = getModelConfig();
  const language = detectLanguage(message);
  const deterministicBrowserCi = process.env.CI === "true" && process.env.AGENT_TEST_RUNTIME === "browser-ci";
  if (process.env.AGENT_TEST_PROVIDER === "deterministic" && (process.env.NODE_ENV !== "production" || deterministicBrowserCi)) {
    return deterministicTestProviderAnswer(product, message, language);
  }

  const attempts: AttemptRecord[] = [];
  let totalLatencyMs = 0;
  let totalCost = 0;
  let hasCost = false;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let hasTokenUsage = false;
  let lastErrorCode: string | null = null;
  let lastErrorMessage: string | null = null;
  const addUsage = (result: ProviderCallResult) => {
    if (result.promptTokens != null) totalPromptTokens += result.promptTokens;
    if (result.completionTokens != null) totalCompletionTokens += result.completionTokens;
    if (result.totalTokens != null) {
      totalTokens += result.totalTokens;
      hasTokenUsage = true;
    } else if (result.promptTokens != null || result.completionTokens != null) {
      totalTokens += (result.promptTokens ?? 0) + (result.completionTokens ?? 0);
      hasTokenUsage = true;
    }
  };

  const callRoute = async (
    route: ProductAgentRoute,
    routeMessage: string,
    languageSourceMessage: string = message,
  ): Promise<ProviderCallResult> => {
    const retries = config.fallbacksEnabled ? 0 : sameRouteRetries();
    let result: ProviderCallResult | null = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      result = await callProvider(
        route,
        product,
        routeMessage,
        pageContext,
        knowledge,
        conversationHistory,
        runtimeConfig,
        languageSourceMessage,
      );
      attempts.push({
        provider: route.provider,
        model: route.model,
        ok: result.ok,
        errorCode: result.errorCode,
        latencyMs: result.latencyMs,
      });
      totalLatencyMs += result.latencyMs;
      addUsage(result);
      if (result.estimatedCost != null) {
        totalCost += result.estimatedCost;
        hasCost = true;
      }

      if (result.ok || !isTransientProviderFailure(result) || attempt === retries) break;
      await waitForRetry(attempt);
    }

    if (!result) throw new Error("Provider route completed without an attempt result");
    return result;
  };

  const configuredProvider: ProductAgentRoute["provider"] = runtimeConfig?.modelProvider === "deepseek-direct" ? "deepseek-direct" : "openrouter";
  const routes: ProductAgentRoute[] = runtimeConfig && config.fallbacksEnabled
    ? [{ provider: configuredProvider, model: runtimeConfig.modelName }, ...config.routes.filter((route) => route.model !== runtimeConfig.modelName)]
    : config.routes;

  for (const route of routes) {
    const result = await callRoute(route, message);

    if (result.ok && result.text) {
      let finalResult = result;
      let finalText = cleanCustomerFacingText(result.text);
      const previousAssistantAnswer = latestAssistantAnswer(conversationHistory);
      const groundingNeeded = needsCatalogGroundingRetry(product, message, finalText, knowledge);
      const duplicateNeeded = previousAssistantAnswer
        ? areAgentAnswersNearDuplicates(finalText, previousAssistantAnswer)
        : false;

      if (groundingNeeded || duplicateNeeded) {
        attempts[attempts.length - 1] = {
          ...attempts[attempts.length - 1],
          ok: false,
          errorCode: duplicateNeeded ? "repeated_answer" : "catalog_grounding_low_confidence",
        };
        const repairResult = await callRoute(
          route,
          buildGroundingRepairMessage(product, message, finalText, duplicateNeeded ? previousAssistantAnswer : null),
          message,
        );

        const repairedText = repairResult.text ? cleanCustomerFacingText(repairResult.text) : null;
        const repairedIsGrounded = repairedText
          ? !needsCatalogGroundingRetry(product, message, repairedText, knowledge)
          : false;
        const repairedIsDistinct = repairedText && previousAssistantAnswer
          ? !areAgentAnswersNearDuplicates(repairedText, previousAssistantAnswer)
          : Boolean(repairedText);

        if (repairResult.ok && repairedText && repairedIsGrounded && repairedIsDistinct) {
          finalResult = repairResult;
          finalText = repairedText;
        } else {
          attempts[attempts.length - 1] = {
            ...attempts[attempts.length - 1],
            ok: false,
            errorCode: repairResult.ok
              ? (repairedIsDistinct ? "catalog_grounding_repair_low_confidence" : "repeated_answer_repair_failed")
              : repairResult.errorCode,
          };
          lastErrorCode = repairResult.ok
            ? (repairedIsDistinct ? "catalog_grounding_repair_low_confidence" : "repeated_answer_repair_failed")
            : repairResult.errorCode;
          lastErrorMessage = repairResult.ok
            ? "Live model repair still missed catalog grounding, language, or follow-up distinctness requirements"
            : repairResult.errorMessage;
          // One targeted repair is enough. Repeated model rewrites made replies
          // slower and more mechanical without adding trustworthy facts.
          // Keep the strongest customer-facing answer and let hard output
          // guardrails reject unsafe claims below.
          finalResult = repairResult.ok && repairedText ? repairResult : result;
          finalText = repairResult.ok && repairedText ? repairedText : finalText;
        }
      }

      finalText = cleanCustomerFacingText(finalText);
      const verifiedLimitMismatch = findVerifiedLimitMismatch(product, message);
      const compatibilityGuardrailApplied = Boolean(
        verifiedLimitMismatch && !hasDirectVerifiedMismatchAnswer(finalText, verifiedLimitMismatch),
      );
      if (verifiedLimitMismatch && compatibilityGuardrailApplied) {
        finalText = deterministicLimitMismatchAnswer(verifiedLimitMismatch, language);
      }
      const priceGroundingApplied = asksAboutPriceOrValue(message) && !mentionsExactCatalogPrice(finalText, product);
      if (priceGroundingApplied) {
        finalText = deterministicPriceGroundedAnswer(product, message, finalText, language);
      }
      const detectedObjection = detectObjection(message);
      const objectionGuidanceApplied = Boolean(
        detectedObjection
        && !verifiedLimitMismatch
        && (!acknowledgesObjection(finalText, detectedObjection, language) || !providesDecisionHelp(finalText)),
      );
      if (detectedObjection && objectionGuidanceApplied) {
        finalText = deterministicObjectionGuidance(product, message, finalText, language, detectedObjection);
      }
      const purchaseIntentGuidanceApplied = !detectedObjection && isDirectPurchaseIntent(message);
      if (purchaseIntentGuidanceApplied) {
        finalText = deterministicPurchaseIntentAnswer(product, language);
      }
      const questionLimitedText = limitAnswerToOneQuestion(finalText, language);
      const questionLimitApplied = questionLimitedText !== finalText;
      finalText = questionLimitedText;
      if (previousAssistantAnswer && areAgentAnswersNearDuplicates(finalText, previousAssistantAnswer)) {
        if (purchaseIntentGuidanceApplied) {
          return {
            text: deterministicPurchaseIntentAnswer(product, language),
            confidence: 0.9,
            mode: "live",
            language,
            provider: route.provider,
            model: route.model,
            providerRoute: `${routeLabel(attempts)}->purchase_intent_guardrail`,
            promptVersion: runtimeConfig ? `merchant-v${runtimeConfig.versionNumber}` : PRODUCT_AGENT_PROMPT_VERSION,
            promptTokens: hasTokenUsage ? totalPromptTokens : finalResult.promptTokens,
            completionTokens: hasTokenUsage ? totalCompletionTokens : finalResult.completionTokens,
            totalTokens: hasTokenUsage ? totalTokens : finalResult.totalTokens,
            estimatedCost: hasCost ? totalCost : finalResult.estimatedCost,
            latencyMs: totalLatencyMs,
            errorCode: null,
            errorMessage: null,
          };
        }
        return {
          text: fallbackText("low_confidence", language),
          fallbackReason: "low_confidence",
          confidence: 0.2,
          mode: "live",
          language,
          provider: route.provider,
          model: route.model,
          providerRoute: `${routeLabel(attempts)}->duplicate_guardrail`,
          promptVersion: runtimeConfig ? `merchant-v${runtimeConfig.versionNumber}` : PRODUCT_AGENT_PROMPT_VERSION,
          promptTokens: hasTokenUsage ? totalPromptTokens : finalResult.promptTokens,
          completionTokens: hasTokenUsage ? totalCompletionTokens : finalResult.completionTokens,
          totalTokens: hasTokenUsage ? totalTokens : finalResult.totalTokens,
          estimatedCost: hasCost ? totalCost : finalResult.estimatedCost,
          latencyMs: totalLatencyMs,
          errorCode: "repeated_answer_repair_failed",
          errorMessage: null,
        };
      }
      const outputGuardrail = evaluateOutputGuardrails(finalText, language, product);
      if (!outputGuardrail.allowed) {
        return {
          text: outputGuardrail.message,
          fallbackReason: outputGuardrail.reason,
          confidence: 0.2,
          mode: "live",
          language,
          provider: route.provider,
          model: route.model,
          providerRoute: `${routeLabel(attempts)}->output_guardrail`,
          promptVersion: runtimeConfig ? `merchant-v${runtimeConfig.versionNumber}` : PRODUCT_AGENT_PROMPT_VERSION,
          promptTokens: hasTokenUsage ? totalPromptTokens : finalResult.promptTokens,
          completionTokens: hasTokenUsage ? totalCompletionTokens : finalResult.completionTokens,
          totalTokens: hasTokenUsage ? totalTokens : finalResult.totalTokens,
          estimatedCost: hasCost ? totalCost : finalResult.estimatedCost,
          latencyMs: totalLatencyMs,
          errorCode: outputGuardrail.triggeredRule ?? "output_guardrail",
          errorMessage: null
        };
      }

      return {
        text: finalText,
        detectedObjection,
        confidence: 0.82,
        mode: "live",
        language,
        provider: route.provider,
        model: route.model,
        providerRoute: `${routeLabel(attempts)}${compatibilityGuardrailApplied ? "->compatibility_guardrail" : ""}${priceGroundingApplied ? "->price_grounding_guardrail" : ""}${objectionGuidanceApplied ? "->objection_guidance_guardrail" : ""}${purchaseIntentGuidanceApplied ? "->purchase_intent_guardrail" : ""}${questionLimitApplied ? "->question_limit_guardrail" : ""}`,
        promptVersion: runtimeConfig ? `merchant-v${runtimeConfig.versionNumber}` : PRODUCT_AGENT_PROMPT_VERSION,
        promptTokens: hasTokenUsage ? totalPromptTokens : finalResult.promptTokens,
        completionTokens: hasTokenUsage ? totalCompletionTokens : finalResult.completionTokens,
        totalTokens: hasTokenUsage ? totalTokens : finalResult.totalTokens,
        estimatedCost: hasCost ? totalCost : finalResult.estimatedCost,
        latencyMs: totalLatencyMs,
        errorCode: null,
        errorMessage: null
      };
    }

    lastErrorCode = result.errorCode;
    lastErrorMessage = result.errorMessage;
  }

  return {
    text: fallbackText("model_error", language),
    fallbackReason: "model_error",
    confidence: 0.2,
    mode: "live",
    language,
    provider: attempts.at(-1)?.provider ?? null,
    model: attempts.at(-1)?.model ?? null,
    providerRoute: routeLabel(attempts) || "no_routes",
    promptVersion: runtimeConfig ? `merchant-v${runtimeConfig.versionNumber}` : PRODUCT_AGENT_PROMPT_VERSION,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    estimatedCost: hasCost ? totalCost : null,
    latencyMs: totalLatencyMs,
    errorCode: lastErrorCode,
    errorMessage: lastErrorMessage
  };
}
