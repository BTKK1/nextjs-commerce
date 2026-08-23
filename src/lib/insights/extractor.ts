import { randomUUID } from "node:crypto";
import type {
  DemoDatabase,
  DemoProduct,
  FallbackReason,
  Insight,
  InsightSource,
  ObjectionCategory,
} from "@/lib/types";

export function normalizeQuestion(question: string): string {
  return question
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[؟?!.،,;:]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyQuestionIntent(message: string): string {
  const normalized = normalizeQuestion(message);
  if (/(price|cost|expensive|sar|سعر|بكم|غالي|تكلفه|تكلفة)/.test(normalized)) return "price";
  if (/(ship|deliver|delivery|arrival|arrive|توصيل|شحن|يوصل|يوصلني)/.test(normalized)) return "shipping";
  if (/(gift|present|هديه|هدية|اهدي|مناسبه)/.test(normalized)) return "gift";
  if (/(quality|premium|original|جوده|جودة|اصلي|فخم|خامه|خامة)/.test(normalized)) return "quality";
  if (/(suitable|fit|for me|practical|مناسب|يناسب|عملي|مجلس|دوام)/.test(normalized)) return "suitability";
  if (/(variant|size|color|finish|pack|حجم|مقاس|لون|نوع|باقه|باقة|خيار|اختار)/.test(normalized)) return "variant";
  if (/(care|wash|clean|store|عنايه|عناية|غسيل|تنظيف|احفظ)/.test(normalized)) return "care";
  if (/(warranty|guarantee|ضمان)/.test(normalized)) return "warranty";
  if (/(certificate|certified|authenticity|معتمد|شهاده|شهادة)/.test(normalized)) return "certification";
  if (/(discount|coupon|code|خصم|كوبون|كود)/.test(normalized)) return "discount";
  return "general";
}

export function detectObjection(message: string): ObjectionCategory | undefined {
  const normalized = normalizeQuestion(message);
  if (/(expensive|too much|price|cheaper|not convinced|convince|غالي|السعر|ارخص|أرخص|مقتنع|اقنعني|اقنعنى)/.test(normalized)) return "price_concern";
  if (/(quality|premium|original|جوده|جودة|اصلي|يتحمل|فخم|خامه|خامة)/.test(normalized)) return "quality_concern";
  if (/(shipping|delivery|arrive|توصيل|شحن|يوصل)/.test(normalized)) return "shipping_concern";
  if (/(gift|present|هديه|هدية|اهدي)/.test(normalized)) return "gift_concern";
  if (/(suitable|fit|for me|practical|مجلس|دوام|مناسب|يناسب|يكفي|عملي)/.test(normalized)) return "suitability_concern";
  if (/(which|variant|size|color|finish|اختار|اي نوع|أي نوع|حجم|مقاس|لون|محتار)/.test(normalized)) return "variant_confusion";
  if (/(care|wash|clean|scratch|عنايه|عناية|تنظيف|يخدش)/.test(normalized)) return "maintenance_concern";
  return undefined;
}

export function detectWeakDescriptionSignal(product: DemoProduct, message: string): string | undefined {
  const intent = classifyQuestionIntent(message);
  const normalized = normalizeQuestion(message);
  if (intent === "warranty") return "missing_warranty";
  if (intent === "certification") return "missing_certification";
  if (intent === "discount") return "unsupported_discount_request";
  if (/(ship|deliver|delivery|arrival|arrive|توصيل|شحن|يوصل|يوصلني)/.test(normalized)
    && /tomorrow|today|exact|بكره|بكرة|اليوم|متى/.test(normalized)) {
    return "missing_delivery_estimate";
  }
  if (/(box|included|inside|وش داخل|مرفق|الصندوق|العلبه|العلبة)/.test(normalized)) return "missing_box_contents";
  for (const signal of product.weakDescriptionSignals) {
    const normalizedSignal = normalizeQuestion(signal);
    const matchesMissingDetail =
      (/inseam/.test(normalizedSignal) && /inseam|طول داخلي|طول الساق/.test(normalized))
      || (/pilling/.test(normalizedSignal) && /pill|pilling|وبر|تكور/.test(normalized))
      || (/opacity/.test(normalizedSignal) && /opacity|opaque|see through|sheer|شفاف|شفافيه/.test(normalized))
      || (/gift packaging/.test(normalizedSignal) && /packag|wrap|box|تغليف|علبه|العلبه|العلبة/.test(normalized))
      || (/tote dimensions/.test(normalizedSignal) && /dimension|measure|height|width|depth|ابعاد|قياس|ارتفاع|عرض|عمق/.test(normalized))
      || (/garment measurements/.test(normalizedSignal) && /garment measure|sleeve|coat length|exact measure|قياسات القطعه|طول الكم|طول المعطف/.test(normalized))
      || (/garment length/.test(normalizedSignal) && /garment length|exact length|top length|طول القطعه|الطول الدقيق/.test(normalized));
    if (matchesMissingDetail) return signal;
  }
  return undefined;
}

interface ExtractionInput {
  db: DemoDatabase;
  merchantId?: string;
  product: DemoProduct;
  conversationId: string;
  userMessageId: string;
  userMessage: string;
  fallbackReason?: FallbackReason;
}

function upsertInsight(
  db: DemoDatabase,
  partial: Omit<Insight, "id" | "count" | "createdAt" | "updatedAt">,
  conversationId: string,
  messageId: string,
): Insight {
  const now = new Date().toISOString();
  const existing = db.insights.find(
    (insight) =>
      insight.productSlug === partial.productSlug &&
      insight.merchantId === partial.merchantId &&
      insight.type === partial.type &&
      insight.category === partial.category,
  );

  if (existing) {
    existing.count += 1;
    existing.updatedAt = now;
    db.insightSources.push({
      id: randomUUID(),
      insightId: existing.id,
      conversationId,
      messageId,
      createdAt: now,
    });
    return existing;
  }

  const insight: Insight = {
    ...partial,
    id: randomUUID(),
    count: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.insights.push(insight);
  db.insightSources.push({
    id: randomUUID(),
    insightId: insight.id,
    conversationId,
    messageId,
    createdAt: now,
  } satisfies InsightSource);
  return insight;
}

export function extractInsightsForMessage(input: ExtractionInput): Insight[] {
  const { db, product, conversationId, userMessageId, userMessage, fallbackReason } = input;
  const merchantId = input.merchantId ?? product.merchantId ?? db.merchants[0].id;
  const created: Insight[] = [];
  const normalized = normalizeQuestion(userMessage);
  const repeatedCount = db.messages.filter((message) => {
    if (message.role !== "user") return false;
    const conversation = db.conversations.find((item) => item.id === message.conversationId);
    return conversation?.merchantId === merchantId && conversation.productSlug === product.slug && normalizeQuestion(message.content) === normalized;
  }).length;

  if (repeatedCount > 1) {
    created.push(
      upsertInsight(
        db,
        {
          merchantId,
          productId: product.id,
          productSlug: product.slug,
          type: "repeated_question",
          category: classifyQuestionIntent(userMessage),
          title: "Repeated shopper question",
          detail: `Repeated question detected: "${userMessage}"`,
        },
        conversationId,
        userMessageId,
      ),
    );
  }

  const objection = detectObjection(userMessage);
  if (objection) {
    created.push(
      upsertInsight(
        db,
        {
          merchantId,
          productId: product.id,
          productSlug: product.slug,
          type: "objection",
          category: objection,
          title: "Shopper objection detected",
          detail: `Detected ${objection.replaceAll("_", " ")} from shopper message.`,
        },
        conversationId,
        userMessageId,
      ),
    );
  }

  const weakSignal = detectWeakDescriptionSignal(product, userMessage);
  if (weakSignal) {
    created.push(
      upsertInsight(
        db,
        {
          merchantId,
          productId: product.id,
          productSlug: product.slug,
          type: "weak_description",
          category: weakSignal,
          title: "Product content improvement signal",
          detail: `Shopper asked for detail not strong enough in the current product copy: ${weakSignal}.`,
        },
        conversationId,
        userMessageId,
      ),
    );
  }

  if (fallbackReason) {
    created.push(
      upsertInsight(
        db,
        {
          merchantId,
          productId: product.id,
          productSlug: product.slug,
          type: "unknown_answer",
          category: fallbackReason,
          title: "Fallback or unknown-answer event",
          detail: `Agent used fallback reason: ${fallbackReason}.`,
        },
        conversationId,
        userMessageId,
      ),
    );
  }

  return created;
}
