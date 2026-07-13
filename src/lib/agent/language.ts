export function detectLanguage(message: string): "ar" | "en" {
  return /[\u0600-\u06ff]/.test(message) ? "ar" : "en";
}

export function fallbackText(reason: string, language: "ar" | "en"): string {
  if (language === "ar") {
    if (reason === "out_of_scope") {
      return "أقدر أساعدك بتفاصيل هذا المنتج أو مقارنته بمنتجات المتجر. هذا الطلب خارج نطاق معلومات المنتج التجريبية.";
    }

    if (reason === "unsafe_request") {
      return "ما أقدر أساعد في هذا الطلب. أقدر أجاوبك عن المنتج، الاستخدام، العناية، السعر الظاهر، أو الخيارات المتاحة.";
    }

    if (reason === "rate_limited") {
      return "وصلنا لعدد رسائل عالي بسرعة. جرّب مرة ثانية بعد لحظات، وبقدر أساعدك بتفاصيل المنتج.";
    }

    if (reason === "low_confidence") {
      return "اكتب سؤالك عن المنتج، المقاس، اللون، الخامة، أو العناية عشان أقدر أساعدك.";
    }

    return "ما عندي هذه المعلومة في بيانات المنتج التجريبية. الأفضل تتأكد من التاجر أو من تفاصيل المنتج قبل الشراء.";
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

  if (reason === "low_confidence") {
    return "Please send a product question so I can help.";
  }

  return "I do not have that detail in the current store catalog data. Please ask the merchant or check the product details before buying.";
}
