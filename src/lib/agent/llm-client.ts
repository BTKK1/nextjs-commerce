import { getModelConfig, PRODUCT_AGENT_PROMPT_VERSION, type ProductAgentProvider, type ProductAgentRoute } from "@/lib/ai/model-config";
import { buildAgentSystemPrompt } from "@/lib/agent/prompt-builder";
import { evaluateOutputGuardrails } from "@/lib/agent/guardrails";
import { detectLanguage, fallbackText } from "@/lib/agent/language";
import { detectObjection } from "@/lib/insights/extractor";
import type { SellerKnowledgeContext } from "@/lib/knowledge/seller-knowledge";
import type { AgentAnswer, AgentConversationTurn, AgentPageContext, DemoProduct } from "@/lib/types";

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

const MODEL_PRICING: Record<string, [number, number]> = {
  "deepseek-chat": [0.27, 1.1],
  "google/gemini-2.5-flash-lite": [0.1, 0.4],
  "qwen/qwen3-235b-a22b-2507": [0.09, 0.1],
  "qwen/qwen3.5-flash-02-23": [0.065, 0.26]
};

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

function estimateCost(model: string, promptTokens: number | null, completionTokens: number | null): number | null {
  const price = MODEL_PRICING[model];
  if (!price || promptTokens == null || completionTokens == null) return null;
  return Number(((promptTokens / 1_000_000) * price[0] + (completionTokens / 1_000_000) * price[1]).toFixed(6));
}

function routeLabel(attempts: AttemptRecord[]): string {
  return attempts.map((attempt) => `${attempt.provider}(${attempt.ok ? "ok" : attempt.errorCode ?? "failed"})`).join("->");
}

function timeoutMs(): number {
  const value = Number(process.env.PRODUCT_AGENT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 30_000;
}

function includesNormalized(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle.toLowerCase());
}

function hasArabic(value: string): boolean {
  return /[\u0600-\u06ff]/.test(value);
}

function buildGroundingRepairMessage(
  product: DemoProduct,
  originalMessage: string,
  previousAnswer: string,
): string {
  const sizeVariant = product.variants.find((variant) => /size/i.test(variant.name));
  const colorVariant = product.variants.find((variant) => /color/i.test(variant.name));
  const firstSizeValue = sizeVariant?.values[0];
  const firstColorValue = colorVariant?.values[0];
  const sizeGuideValue = product.sizeGuide?.[0]?.value;

  return [
    "Revise the assistant answer for the shopper's original message.",
    "Use only the Product and catalog context from the system prompt.",
    `Original shopper message: ${originalMessage}`,
    `Previous weak answer: ${previousAnswer}`,
    "Return only the revised customer-facing answer.",
    "Keep the revised answer under 130 words, with at most two short paragraphs.",
    "Do not use Markdown formatting, bold text, or labels such as Catalog-backed detail.",
    `Required current product name: ${product.name}`,
    `Required visible price if price is relevant: ${formatPriceForRepair(product)}`,
    sizeVariant ? `If size or fit is relevant, include the exact variant label "${sizeVariant.name}".` : null,
    firstSizeValue ? `If size or fit is relevant, include at least one exact size value such as "${firstSizeValue}".` : null,
    sizeGuideValue ? `If fit measurements are relevant, include the exact size guide wording "${sizeGuideValue}".` : null,
    colorVariant ? `If color is relevant, include the exact variant label "${colorVariant.name}".` : null,
    firstColorValue ? `If color is relevant, include at least one exact color value such as "${firstColorValue}".` : null,
    "If the original shopper wrote Arabic, answer in simple neutral Saudi Arabic and include the exact English product name once.",
    "Do not invent discounts, delivery dates, warranties, certifications, or unsupported claims.",
    "End with one short product-page next step when safe."
  ]
    .filter(Boolean)
    .join("\n");
}

function formatPriceForRepair(product: DemoProduct): string {
  return `${product.priceSar} SAR`;
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
  const asksPrice = /price|cost|worth|value|سعر|بكم|تكلفة/.test(normalizedMessage);
  const asksVariantList = /what variants|which variants|options do you have|available options|what options|خيارات|مقاسات|ألوان|الوان/.test(normalizedMessage);
  const asksComparison = /compare|related product|related item|compare this with|فرق|قارن|مقارنة|المنتج الثاني/.test(normalizedMessage);
  const asksShipping = /ship|shipping|delivery|deliver|return|returns|شحن|توصيل|يوصل|إرجاع|ارجاع/.test(normalizedMessage);
  const asksSize = /size|fit|chest|مقاس|حجم|يناسب/.test(normalizedMessage);
  const asksWarmthOrMaterial = /warm|winter|cold|material|fabric|quality|جودة|خامة|خامات|دافي|شتاء|برد/.test(normalizedMessage);
  const primaryRelatedName = knowledge?.relatedProducts[0]?.name;
  const requiresComplimentaryShipping = /complimentary shipping/i.test(product.careShippingNotes);
  const requiresReturns = /returns?/i.test(product.careShippingNotes);
  const sizeVariant = product.variants.find((variant) => /size/i.test(variant.name));
  const colorVariant = product.variants.find((variant) => /color/i.test(variant.name));
  const firstSizeValue = sizeVariant?.values[0];
  const firstColorValue = colorVariant?.values[0];
  const firstSizeGuideValue = product.sizeGuide?.[0]?.value;
  const requiredMaterialWords = (product.material?.match(/[A-Za-z]+/g) ?? [])
    .filter((word) => word.length > 3)
    .slice(0, 2);

  if (cleanText.length < 24 || tokenCount < 4) return true;
  if (!/[.!?؟]$/.test(cleanText)) return true;
  if (language === "ar" && !hasArabic(cleanText)) return true;
  if (!includesNormalized(cleanText, product.name)) return true;
  if (asksPrice && !cleanText.includes(String(product.priceSar))) return true;
  if (asksVariantList && sizeVariant && !includesNormalized(cleanText, sizeVariant.name)) return true;
  if (asksVariantList && colorVariant && !includesNormalized(cleanText, colorVariant.name)) return true;
  if (asksVariantList && firstSizeValue && !includesNormalized(cleanText, firstSizeValue)) return true;
  if (asksVariantList && firstColorValue && !includesNormalized(cleanText, firstColorValue)) return true;
  if (asksShipping && requiresComplimentaryShipping && !includesNormalized(cleanText, "Complimentary shipping")) return true;
  if (asksShipping && requiresReturns && !includesNormalized(cleanText, "returns")) return true;
  if (language === "en" && asksSize && sizeVariant && !includesNormalized(cleanText, sizeVariant.name)) return true;
  if (asksSize && firstSizeValue && !includesNormalized(cleanText, firstSizeValue)) return true;
  if (language === "en" && asksSize && firstSizeGuideValue && /chest/i.test(firstSizeGuideValue) && !includesNormalized(cleanText, "Chest")) return true;
  if (asksWarmthOrMaterial && requiredMaterialWords.some((word) => !includesNormalized(cleanText, word))) return true;
  if (asksComparison && primaryRelatedName && !includesNormalized(cleanText, primaryRelatedName)) return true;
  return false;
}

function cleanCustomerFacingText(text: string): string {
  const cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^catalog-backed detail:.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= 820) return cleaned;

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const compact = paragraphs.slice(0, 2).join("\n\n").trim();
  if (!compact) return cleaned.slice(0, 760).trim();
  return compact;
}

async function callProvider(
  route: ProductAgentRoute,
  product: DemoProduct,
  message: string,
  pageContext?: AgentPageContext,
  knowledge?: SellerKnowledgeContext,
  conversationHistory: AgentConversationTurn[] = [],
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
      headers["X-Title"] = config.appName || "Saleh Stores AI Sales Agent Demo";
    }

    const response = await fetch(`${providerBaseUrl(route.provider)}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model: route.model,
        temperature: 0.25,
        max_tokens: 420,
        messages: [
          { role: "system", content: buildAgentSystemPrompt(product, pageContext, knowledge) },
          ...conversationHistory,
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
      estimatedCost: reportedCost != null ? Number(reportedCost) : estimateCost(route.model, promptTokens, completionTokens),
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
): Promise<AgentAnswer> {
  const config = getModelConfig();
  const language = detectLanguage(message);

  const attempts: AttemptRecord[] = [];
  let totalLatencyMs = 0;
  let totalCost = 0;
  let hasCost = false;
  let lastErrorCode: string | null = null;
  let lastErrorMessage: string | null = null;

  for (const route of config.routes) {
    const result = await callProvider(route, product, message, pageContext, knowledge, conversationHistory);
    attempts.push({
      provider: route.provider,
      model: route.model,
      ok: result.ok,
      errorCode: result.errorCode,
      latencyMs: result.latencyMs
    });
    totalLatencyMs += result.latencyMs;
    if (result.estimatedCost != null) {
      totalCost += result.estimatedCost;
      hasCost = true;
    }

    if (result.ok && result.text) {
      let finalResult = result;
      let finalText = result.text;

      if (needsCatalogGroundingRetry(product, message, finalText, knowledge)) {
        attempts[attempts.length - 1] = {
          ...attempts[attempts.length - 1],
          ok: false,
          errorCode: "catalog_grounding_low_confidence",
        };
        const repairResult = await callProvider(
          route,
          product,
          buildGroundingRepairMessage(product, message, finalText),
          pageContext,
          knowledge,
          conversationHistory,
        );
        attempts.push({
          provider: route.provider,
          model: route.model,
          ok: repairResult.ok,
          errorCode: repairResult.errorCode,
          latencyMs: repairResult.latencyMs
        });
        totalLatencyMs += repairResult.latencyMs;
        if (repairResult.estimatedCost != null) {
          totalCost += repairResult.estimatedCost;
          hasCost = true;
        }

        if (repairResult.ok && repairResult.text && !needsCatalogGroundingRetry(product, message, repairResult.text, knowledge)) {
          finalResult = repairResult;
          finalText = repairResult.text;
        } else {
          attempts[attempts.length - 1] = {
            ...attempts[attempts.length - 1],
            ok: false,
            errorCode: repairResult.ok ? "catalog_grounding_repair_low_confidence" : repairResult.errorCode,
          };
          lastErrorCode = repairResult.ok ? "catalog_grounding_repair_low_confidence" : repairResult.errorCode;
          lastErrorMessage = repairResult.ok
            ? "Live model repaired answer still missed required catalog grounding or language requirements"
            : repairResult.errorMessage;
          if (repairResult.ok && repairResult.text) {
            finalResult = repairResult;
            finalText = repairResult.text;
          }
        }
      }

      finalText = cleanCustomerFacingText(finalText);
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
          promptVersion: PRODUCT_AGENT_PROMPT_VERSION,
          promptTokens: finalResult.promptTokens,
          completionTokens: finalResult.completionTokens,
          totalTokens: finalResult.totalTokens,
          estimatedCost: hasCost ? totalCost : finalResult.estimatedCost,
          latencyMs: totalLatencyMs,
          errorCode: outputGuardrail.triggeredRule ?? "output_guardrail",
          errorMessage: null
        };
      }

      return {
        text: finalText,
        detectedObjection: detectObjection(message),
        confidence: 0.82,
        mode: "live",
        language,
        provider: route.provider,
        model: route.model,
        providerRoute: routeLabel(attempts),
        promptVersion: PRODUCT_AGENT_PROMPT_VERSION,
        promptTokens: finalResult.promptTokens,
        completionTokens: finalResult.completionTokens,
        totalTokens: finalResult.totalTokens,
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
    promptVersion: PRODUCT_AGENT_PROMPT_VERSION,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    estimatedCost: hasCost ? totalCost : null,
    latencyMs: totalLatencyMs,
    errorCode: lastErrorCode,
    errorMessage: lastErrorMessage
  };
}
