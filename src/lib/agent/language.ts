export function detectLanguage(message: string): "ar" | "en" {
  return /[\u0600-\u06ff]/.test(message) ? "ar" : "en";
}

export function fallbackText(reason: string, language: "ar" | "en"): string {
  if (language === "ar") {
    if (reason === "out_of_scope") {
      return "أقدر أساعدك بالمنتج أو أقارنه لك بخيارات المتجر، لكن هالطلب خارج المعلومات المتوفرة عندي.";
    }

    if (reason === "unsafe_request") {
      return "ما أقدر أساعد بهالطلب. أقدر أفيدك بالمنتج، استخدامه، سعره، أو الخيارات المتاحة.";
    }

    if (reason === "rate_limited") {
      return "الرسائل جت بسرعة شوي. جرّب بعد لحظات ونكمل من نفس النقطة.";
    }

    if (reason === "quota_exhausted") {
      return "نبيه غير متاح حاليًا في هالمتجر. جرّب مرة ثانية لاحقًا.";
    }

    if (reason === "low_confidence") {
      return "وش حاب تعرف عن المنتج؟ اسألني عن المقاس، الخامة، السعر، أو استخدامه.";
    }

    return "هالمعلومة مو واضحة عندي حاليًا، وما أبي أعطيك شيء غير دقيق. الأفضل نتأكد منها من المتجر.";
  }

  if (reason === "out_of_scope") {
    return "I can help with this product, related catalog items, visible price, variants, use, care, and gift fit. That request is outside the current store catalog data.";
  }

  if (reason === "unsafe_request") {
    return "I cannot help with that request. I can still answer product, care, price, variant, and gift-fit questions from the current store catalog.";
  }

  if (reason === "rate_limited") {
    return "This visitor is sending messages too quickly. Please try again in a moment and I can continue with product details.";
  }

  if (reason === "quota_exhausted") {
    return "Nbeh is temporarily unavailable in this store. Please try again later.";
  }

  if (reason === "low_confidence") {
    return "Please send a product question so I can help.";
  }

  return "I do not have that detail in the current store catalog data. Please ask the merchant or check the product details before buying.";
}
