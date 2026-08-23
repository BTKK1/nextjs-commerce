import type { DemoProduct, StorefrontLocale } from "@/lib/types";

export type StoreLocale = StorefrontLocale;

export const STORE_LOCALE_KEY = "maison-vert-locale";

export const storeCopy = {
  en: {
    nav: {
      shop: "Shop",
      story: "Story",
      journal: "Journal",
      bag: "Bag",
      languageLabel: "Store language",
      english: "English",
      arabic: "Arabic",
    },
    footer: {
      description: "Considered clothing, made in small runs from natural fibers.",
      shop: "Shop",
      help: "Help",
      newsletter: "Newsletter",
      newsletterText: "New arrivals, occasional letters. No noise.",
      join: "Join",
      emailPlaceholder: "you@example.com",
      categories: ["Outerwear", "Knitwear", "Denim", "Accessories"],
      helpItems: ["Shipping & Returns", "Size Guide", "Care", "Contact"],
    },
    home: {
      eyebrow: "Autumn / Winter - Collection 07",
      headline: "Quiet clothes for a loud world.",
      intro: "Made in small runs from natural fibers - wool, cashmere, linen, cotton - by craftspeople we know by name.",
      shopCta: "Shop the collection",
      storyCta: "Our story",
      valueStrip: [
        "Complimentary shipping over $150",
        "Free returns within 30 days",
        "Made in Italy, Portugal, Japan",
        "Carbon-neutral delivery",
      ],
      editEyebrow: "The Edit",
      editTitle: "A small collection, worn often.",
      browseCategories: "Browse categories",
      practiceEyebrow: "Our practice",
      practiceTitle: "Fewer, better things - designed to be lived in.",
      practiceBodyOne:
        "Maison Vert began in a small studio in Antwerp with a simple idea: a wardrobe of a dozen pieces you actually reach for. We work with mills and ateliers who have been at their craft for generations.",
      practiceBodyTwo:
        "Every piece is made in a run of fifty or fewer, from a fiber that can be traced back to the field it grew in. When something sells out, we make it again - carefully, and only when we are ready.",
      journalEyebrow: "From the journal",
      fieldNotes: "Field notes",
      journalTitlePrefix: "On the making of the",
      collectionProductName: "the Maison Vert collection",
    },
    product: {
      back: "Back to collection",
      pieces: "pieces",
      color: "Color",
      size: "Size",
      sizeGuide: "Size guide",
      buyNow: "Buy now",
      details: "Details and specs",
      keyDetails: "Key details",
      specs: "Specs",
      careShipping: "Care and shipping",
      checkoutNote: "Checkout is a local demo. The bag, selected size, selected color, and quantity are stored in this browser.",
      faqs: "FAQs",
      agentQuestions: "Common questions the agent can handle",
      youMayAlsoLike: "You may also like",
      relatedPieces: "Related pieces",
      fitNotes: "Fit notes",
      closeSizeGuide: "Close size guide",
      sizeGuidance:
        "Measurements are guidance for this demo store. If you are between sizes, choose the larger size for a more relaxed Maison Vert fit.",
    },
    card: {
      viewPiece: "View piece",
    },
    cart: {
      add: "Add to bag",
      added: "Added to bag",
      addTitle: "Add {product} in {color}, size {size} to the bag",
    },
    agent: {
      title: "Nbeh",
      productGuide: "Your in-store sales assistant for {product}",
      clear: "Clear conversation",
      close: "Close Nbeh chat",
      open: "Chat with Nbeh",
      askLabel: "Ask Nbeh about this product",
      placeholder: "Ask Nbeh...",
      send: "Send",
      thinking: "Nbeh is checking the product details...",
      fallback: "I couldn't answer that right now. Try asking me another question about the product.",
      greeting:
        "Hi, I'm Nbeh. Ask me anything about {product} and I'll help you see if it fits what you need.",
    },
  },
  ar: {
    nav: {
      shop: "تسوق",
      story: "القصة",
      journal: "اليوميات",
      bag: "السلة",
      languageLabel: "لغة المتجر",
      english: "English",
      arabic: "العربية",
    },
    footer: {
      description: "ملابس مدروسة، تصنع بكميات صغيرة من ألياف طبيعية.",
      shop: "تسوق",
      help: "المساعدة",
      newsletter: "النشرة",
      newsletterText: "قطع جديدة ورسائل قليلة. بلا إزعاج.",
      join: "انضم",
      emailPlaceholder: "you@example.com",
      categories: ["معاطف", "كنزات", "دنيم", "إكسسوارات"],
      helpItems: ["الشحن والإرجاع", "دليل المقاسات", "العناية", "تواصل معنا"],
    },
    home: {
      eyebrow: "خريف / شتاء - مجموعة 07",
      headline: "ملابس هادئة لعالم صاخب.",
      intro: "تصنع بكميات صغيرة من الصوف، الكشمير، الكتان، والقطن على يد حرفيين نعرفهم بالاسم.",
      shopCta: "تسوق المجموعة",
      storyCta: "قصتنا",
      valueStrip: [
        "شحن مجاني للطلبات فوق 150 دولار",
        "إرجاع مجاني خلال 30 يومًا",
        "صنعت في إيطاليا والبرتغال واليابان",
        "توصيل محايد الكربون",
      ],
      editEyebrow: "الاختيار",
      editTitle: "مجموعة صغيرة، تلبس كثيرًا.",
      browseCategories: "تصفح التصنيفات",
      practiceEyebrow: "نهجنا",
      practiceTitle: "قطع أقل وأفضل - مصممة لتعيش معك.",
      practiceBodyOne:
        "بدأت Maison Vert في استوديو صغير بفكرة بسيطة: خزانة من قطع قليلة سترتديها دائمًا. نعمل مع مشاغل ومصانع أقمشة لها خبرة طويلة.",
      practiceBodyTwo:
        "كل قطعة تصنع بدفعة من خمسين قطعة أو أقل، ومن ألياف يمكن تتبع مصدرها. وعندما تنفد قطعة، نعيد صنعها بعناية وفي الوقت المناسب.",
      journalEyebrow: "من اليوميات",
      fieldNotes: "ملاحظات",
      journalTitlePrefix: "عن صناعة",
      collectionProductName: "مجموعة Maison Vert",
    },
    product: {
      back: "العودة للمجموعة",
      pieces: "قطعة",
      color: "اللون",
      size: "المقاس",
      sizeGuide: "دليل المقاسات",
      buyNow: "اشتر الآن",
      details: "التفاصيل والمواصفات",
      keyDetails: "تفاصيل أساسية",
      specs: "المواصفات",
      careShipping: "العناية والشحن",
      checkoutNote: "الدفع هنا تجربة محلية. السلة والمقاس واللون والكمية تحفظ في هذا المتصفح.",
      faqs: "الأسئلة الشائعة",
      agentQuestions: "أسئلة يستطيع المساعد التعامل معها",
      youMayAlsoLike: "قد يعجبك أيضًا",
      relatedPieces: "قطع مرتبطة",
      fitNotes: "ملاحظات القصة",
      closeSizeGuide: "إغلاق دليل المقاسات",
      sizeGuidance: "المقاسات إرشادية لهذا المتجر التجريبي. إذا كنت بين مقاسين، اختر الأكبر لقصة Maison Vert الأكثر راحة.",
    },
    card: {
      viewPiece: "عرض القطعة",
    },
    cart: {
      add: "أضف للسلة",
      added: "تمت الإضافة",
      addTitle: "أضف {product} بلون {color} ومقاس {size} إلى السلة",
    },
    agent: {
      title: "نبيه",
      productGuide: "مساعد مبيعاتك داخل المتجر لـ {product}",
      clear: "مسح المحادثة",
      close: "إغلاق محادثة نبيه",
      open: "اسأل نبيه",
      askLabel: "اسأل نبيه عن المنتج",
      placeholder: "اسأل نبيه...",
      send: "إرسال",
      thinking: "نبيه يراجع تفاصيل المنتج...",
      fallback: "ما قدرت أجاوبك الحين. جرّب تسألني سؤال ثاني عن المنتج.",
      greeting:
        "هلا، أنا نبيه. اسألني عن {product} وبساعدك تعرف إذا يناسب احتياجك.",
    },
  },
} as const;

const arabicProducts: Record<string, Partial<DemoProduct>> = {
  "atelier-wool-coat": {
    name: "معطف صوف أتلييه",
    category: "معاطف",
    tagline: "قصة هادئة من صوف مزدوج الوجه.",
    shortDescription: "معطف صوف بوجهين وقصة مريحة، ناعم على الكتف ويصلح للطبقات اليومية.",
    longDescription:
      "معطف صوف بوجهين من نسيج ناعم وقصة واسعة قليلًا. مصمم ليدفئ دون ثقل، مع ياقة نظيفة وجيوب عملية وخياطة هادئة.",
  },
  "noir-cashmere-crew": {
    name: "كنزة كشمير نوار",
    category: "كنزات",
    tagline: "كنزة يومية بتفاصيل أهدأ.",
    shortDescription: "كنزة كشمير بقصة مريحة وحواف مضبوطة لتناسب العمل ونهاية الأسبوع.",
    longDescription:
      "كنزة كشمير ناعمة بوزن متوسط وقصة مستقيمة. تمنح دفئًا خفيفًا وملمسًا فاخرًا مع تفاصيل بسيطة تدوم.",
  },
  "high-rise-straight-denim": {
    name: "جينز مستقيم بخصر عال",
    category: "دنيم",
    tagline: "دنيم متين يلين مع الارتداء.",
    shortDescription: "جينز ياباني مستقيم بخصر عال وحافة سلفدج نظيفة.",
    longDescription:
      "جينز مستقيم من دنيم ياباني متين يلين تدريجيًا مع الاستخدام. قصة عالية الخصر تناسب القطع العلوية البسيطة والطبقات.",
  },
  "poplin-oxford-shirt": {
    name: "قميص أوكسفورد بوبلين",
    category: "قمصان",
    tagline: "القميص الأبيض بلا تعقيد.",
    shortDescription: "قميص قطن برتغالي هش بياقة ناعمة وأزرار صدفية.",
    longDescription:
      "قميص أوكسفورد من قطن برتغالي بقصة نظيفة وملمس منعش. يعمل تحت المعطف أو وحده بأناقة هادئة.",
  },
  "everyday-leather-tote": {
    name: "حقيبة جلد يومية",
    category: "إكسسوارات",
    tagline: "جلد نباتي الدباغة مصمم للحاسوب والدفتر والاستخدام اليومي.",
    shortDescription: "حقيبة جلد نباتي الدباغة بحجم يناسب الحاسوب والدفتر واليوم الطويل.",
    longDescription:
      "حقيبة من جلد توسكان نباتي الدباغة تكتسب طبقة جميلة مع الاستخدام. تتسع لحاسوب 14 بوصة ودفتر وزجاجة ماء.",
  },
  "pleated-linen-trouser": {
    name: "بنطال كتان بليسيه",
    category: "بناطيل",
    tagline: "كتان دافئ الطابع بقصة ناعمة.",
    shortDescription: "بنطال كتان بخصر متوسط وطيات أمامية وقصة واسعة خفيفة.",
    longDescription:
      "بنطال كتان أيرلندي بخصر متوسط وطيات أمامية. صمم ليمنح حركة مريحة ومظهرًا مرتبًا مع القمصان والكنزات.",
  },
  "silk-square-scarf": {
    name: "وشاح حرير مربع",
    category: "إكسسوارات",
    tagline: "وشاح حرير خفيف بألوان هادئة.",
    shortDescription: "وشاح حرير تويل بحواف ملفوفة يدويًا للرقبة أو الشعر أو يد الحقيبة.",
    longDescription:
      "وشاح مربع من حرير تويل إيطالي بلمسة مطفية ناعمة. حجمه مناسب للرقبة أو الشعر أو لفه حول يد الحقيبة.",
  },
  "ribbed-merino-tank": {
    name: "توب ميرينو مضلع",
    category: "كنزات",
    tagline: "طبقة أساسية مضلعة بلمسة مرتبة.",
    shortDescription: "توب ميرينو خفيف ومضلع للبس تحت القمصان والكنزات والجاكيتات.",
    longDescription:
      "محاك من صوف ميرينو ناعم بتضليع ضيق، يعمل كطبقة قابلة للتنفس أو كقطعة صيفية نظيفة.",
  },
};

export function isStoreLocale(value: string | null): value is StoreLocale {
  return value === "en" || value === "ar";
}

export function isArabicStorePath(pathname: string) {
  return pathname === "/ar/store" || pathname.startsWith("/ar/store/");
}

export function localeFromStorePath(pathname: string): StoreLocale {
  return isArabicStorePath(pathname) ? "ar" : "en";
}

export function stripStoreLocalePrefix(pathname: string) {
  const cleanPathname = pathname || "/";
  if (cleanPathname === "/ar/store") return "/store";
  if (cleanPathname.startsWith("/ar/store/")) return cleanPathname.slice(3) || "/store";
  return cleanPathname;
}

export function localizeStorePath(href: string, locale: StoreLocale) {
  const [pathAndQuery, hash = ""] = href.split("#");
  const [pathname, query = ""] = pathAndQuery.split("?");
  const basePathname = stripStoreLocalePrefix(pathname || "/store");
  const normalizedPathname = basePathname.startsWith("/") ? basePathname : `/${basePathname}`;
  const storePathname =
    normalizedPathname === "/" ? "/store" : normalizedPathname.startsWith("/store") ? normalizedPathname : `/store${normalizedPathname}`;
  const localizedPathname = locale === "ar" ? `/ar${storePathname}` : storePathname;
  const querySuffix = query ? `?${query}` : "";
  const hashSuffix = hash ? `#${hash}` : "";
  return `${localizedPathname}${querySuffix}${hashSuffix}`;
}

export function getLanguageRoutes(pathname: string) {
  const route = pathname || "/store";
  const withoutTrailingSlash = route.length > 1 ? route.replace(/\/$/, "") : route;
  const isArabic = isArabicStorePath(withoutTrailingSlash);
  const englishPath = isArabic ? stripStoreLocalePrefix(withoutTrailingSlash) : withoutTrailingSlash;
  const arabicPath = isArabic ? withoutTrailingSlash : localizeStorePath(withoutTrailingSlash, "ar");

  return {
    isArabic,
    englishPath: englishPath || "/store",
    arabicPath,
  };
}

export function productCopy(product: DemoProduct, locale: StoreLocale): DemoProduct {
  if (locale === "en") return product;
  return { ...product, ...arabicProducts[product.slug] };
}

export function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}
