import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const loader = String.raw`(() => {
  const SCRIPT_ID = "nbeh-salla-agent";
  const HOST_ID = "nbeh-salla-agent-host";
  const script = document.currentScript || document.getElementById(SCRIPT_ID) || { dataset: {}, src: "" };
  if (document.getElementById(HOST_ID)) return;

  const origin = script.src && /(^|\.)nbeh\.io$/i.test(new URL(script.src, location.href).hostname)
    ? new URL(script.src, location.href).origin
    : "https://www.nbeh.io";
  const readConfig = (key) => {
    try { return window.salla?.config?.get(key) ?? null; } catch { return null; }
  };
  const clean = (value) => String(value ?? "").trim().slice(0, 160);
  const merchantKey = clean(script.dataset.merchantKey || script.dataset.storeId || readConfig("store.id"));
  if (!merchantKey) {
    console.error("[Nbeh] Salla store.id is unavailable.");
    return;
  }

  const locale = () => {
    const value = clean(script.dataset.locale || readConfig("store.locale") || document.documentElement.lang).toLowerCase();
    return value.startsWith("ar") || document.documentElement.dir === "rtl" ? "ar" : "en";
  };
  const productRef = () => clean(
    script.dataset.productRef ||
    readConfig("product.id") ||
    document.querySelector('meta[property="product:retailer_item_id"]')?.getAttribute('content') ||
    document.querySelector('form input[name="product_id"]')?.value ||
    document.querySelector('salla-add-product-button[product-id]')?.getAttribute('product-id') ||
    document.querySelector('salla-product-options[product-id]')?.getAttribute('product-id') ||
    document.querySelector('[itemtype*="schema.org/Product"] [data-product-id]')?.getAttribute('data-product-id')
  );
  const productName = () => clean(
    script.dataset.productName ||
    readConfig("product.name") ||
    document.querySelector('[itemprop="name"]')?.textContent ||
    document.querySelector('h1')?.textContent ||
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    document.title
  );

  const isProductPage = () => Boolean(productRef() && productName());
  const mount = () => {
  if (document.getElementById(HOST_ID) || !isProductPage()) return;

  let lang = locale();
  let currentProduct = productRef();
  let canonicalProductName = "";
  let productConfigReady = false;
  let productConfigFailure = "temporary";
  const displayedProductName = () => canonicalProductName || productName();
  let conversationId = null;
  let preferences = {
    tonePreset: "neutral_saudi",
    arabicDialect: "white_saudi",
    positionAr: "right",
    positionEn: "right",
    autoPopupEnabled: true,
    autoPopupDelaySeconds: 3,
    teaserMessageAr: "محتار؟ اسأل نبيه عن المنتج",
    teaserMessageEn: "Need help choosing? Ask Nbeh",
  };
  let autoPopupTimer = null;
  const trackedEvents = new Set();
  const visitorStorageKey = "nbeh:salla:visitor:" + merchantKey;
  let visitorRef;
  try {
    visitorRef = localStorage.getItem(visitorStorageKey);
    if (!/^anon-[a-zA-Z0-9-]{4,64}$/.test(visitorRef || "")) {
      visitorRef = "anon-" + crypto.getRandomValues(new Uint32Array(2)).join("");
      localStorage.setItem(visitorStorageKey, visitorRef);
    }
  } catch {
    visitorRef = "anon-" + Math.random().toString(36).slice(2, 12);
  }

  const copy = {
    ar: {
      title: "نبيه",
      productGuide: "مساعد مبيعاتك داخل المتجر لـ {product}",
      open: "اسأل نبيه",
      welcome: "هلا! أنا نبيه. اسألني عن هذا المنتج وبساعدك تقرر إذا يناسبك.",
      noProduct: "افتح أي منتج وبعدها اسأل نبيه عنه.",
      productUnavailable: "تفاصيل هذا المنتج ما وصلت لنبيه للحين. جرّب بعد لحظات، وإذا استمرت المشكلة يحتاج صاحب المتجر يعمل مزامنة للمنتجات.",
      catalogTemporarilyUnavailable: "تعذر تحميل تفاصيل المنتج الآن. جرّب مرة ثانية بعد شوي.",
      storeProducts: "منتجات المتجر",
      placeholder: "اسأل نبيه...",
      send: "إرسال",
      error: "تعذر الاتصال بنبيه الآن. جرّب مرة ثانية بعد شوي.",
      thinking: "نبيه يراجع تفاصيل المنتج...",
      reset: "بدء محادثة جديدة",
      close: "إغلاق",
      download: "تنزيل محادثة نبيه",
      poweredBy: "مدعوم من نبيه",
    },
    en: {
      title: "Nbeh",
      productGuide: "Your in-store sales assistant for {product}",
      open: "Ask Nbeh",
      welcome: "Hi! I’m Nbeh. Ask me about this product and I’ll help you decide if it suits you.",
      noProduct: "Open any product, then ask Nbeh about it.",
      productUnavailable: "Nbeh does not have this product's latest details yet. Try again shortly; if it continues, the store owner should sync products.",
      catalogTemporarilyUnavailable: "Nbeh could not load this product's details right now. Please try again shortly.",
      storeProducts: "the store’s products",
      placeholder: "Ask Nbeh...",
      send: "Send",
      error: "Nbeh could not connect right now. Please try again shortly.",
      thinking: "Nbeh is checking the product details...",
      reset: "Start a new conversation",
      close: "Close",
      download: "Download Nbeh conversation",
      poweredBy: "Powered by Nbeh",
    },
  };
  const t = () => copy[lang];

  const trackEvent = (type) => {
    if (!currentProduct) return;
    const key = type + ":" + currentProduct;
    if (trackedEvents.has(key)) return;
    trackedEvents.add(key);
    void fetch(origin + "/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ type, merchantKey, productSlug: currentProduct, visitorRef, locale: lang }),
    }).catch(() => trackedEvents.delete(key));
  };

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-nbeh-store", merchantKey);
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  const installOutfit = async () => {
    if (!("FontFace" in window) || !document.fonts) return;
    try {
      const response = await fetch(origin + "/api/widget/font", { cache: "force-cache" });
      if (!response.ok) return;
      const face = new FontFace("Outfit", await response.arrayBuffer(), {
        style: "normal",
        weight: "400 600",
        display: "swap",
      });
      await face.load();
      document.fonts.add(face);
    } catch {}
  };
  void installOutfit();
  const logoSvg = '<svg class="nbeh-face" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><path d="M 42 10 H 78 A 32 32 0 0 1 110 42 V 78 A 32 32 0 0 1 78 110 H 18 A 8 8 0 0 1 10 102 V 42 A 32 32 0 0 1 42 10 Z" fill="#5B2EFF"/><circle cx="42" cy="52" r="9" fill="white"/><circle cx="78" cy="52" r="9" fill="white"/><path d="M42 76 Q60 90 78 76" fill="none" stroke="white" stroke-width="8" stroke-linecap="round"/></svg>';
  const thinkingLogoSvg = '<svg class="nbeh-face" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><path d="M 42 10 H 78 A 32 32 0 0 1 110 42 V 78 A 32 32 0 0 1 78 110 H 18 A 8 8 0 0 1 10 102 V 42 A 32 32 0 0 1 42 10 Z" fill="#5B2EFF"/><g class="thought-dots"><circle cx="46" cy="27" r="3.6" fill="white"/><circle cx="60" cy="27" r="3.6" fill="white"/><circle cx="74" cy="27" r="3.6" fill="white"/></g><circle cx="45" cy="55" r="8" fill="white"/><circle cx="81" cy="55" r="8" fill="white"/><path d="M52 80 Q60 86 68 80" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/></svg>';
  const eraserSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/></svg>';
  const closeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  const sendSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';
  root.innerHTML = '<style>' +
    ':host{all:initial;font-family:"Outfit",Arial,sans-serif;color:#0B0E12;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}' +
    '*{box-sizing:border-box}.nbeh-face{display:block;width:100%;height:100%;border-radius:16px;overflow:hidden}.nbeh-launch{position:fixed;z-index:2147483000;right:max(24px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));width:68px;height:68px;border:1px solid rgba(255,255,255,.4);border-radius:22px;background:#fff;box-shadow:0 20px 45px -18px rgba(91,46,255,.75),0 8px 24px -18px rgba(11,14,18,.6),0 0 0 1px rgba(91,46,255,.1);display:grid;place-items:center;padding:6px;color:#fff;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}.nbeh-launch[aria-expanded="true"]{display:none}.nbeh-launch:hover{transform:translateY(-4px);box-shadow:0 24px 52px -18px rgba(91,46,255,.82),0 8px 24px -18px rgba(11,14,18,.6)}.nbeh-launch:active{transform:translateY(0) scale(.98)}.nbeh-launch .nbeh-face{filter:drop-shadow(0 8px 14px rgba(74,33,214,.22))}.teaser{position:fixed;z-index:2147482999;right:max(24px,env(safe-area-inset-right));bottom:max(104px,calc(env(safe-area-inset-bottom) + 80px));max-width:min(280px,calc(100dvw - 48px));border:1px solid #DDD5FF;border-radius:16px;background:rgba(255,255,255,.97);padding:11px 14px;color:#302645;font-family:inherit;font-size:13px;font-weight:600;line-height:19px;text-align:start;box-shadow:0 18px 46px -25px rgba(45,31,79,.7),0 8px 22px -18px rgba(91,46,255,.65);cursor:pointer;animation:teaser-in .28s cubic-bezier(.2,.8,.2,1);transition:transform .2s ease,border-color .2s ease}.teaser:after{content:"";position:absolute;right:24px;bottom:-6px;width:12px;height:12px;border-right:1px solid #DDD5FF;border-bottom:1px solid #DDD5FF;background:white;transform:rotate(45deg)}.teaser:hover{transform:translateY(-2px);border-color:#BFB1FF}.teaser[hidden]{display:none}@keyframes teaser-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '.panel{position:fixed;z-index:2147483001;right:max(24px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));width:clamp(340px,34vw,440px);max-width:calc(100dvw - 32px);height:clamp(620px,72dvh,720px);max-height:min(720px,calc(100dvh - 96px));background:rgba(255,255,255,.95);border:1px solid #E4E6EC;border-radius:24px;box-shadow:0 24px 60px rgba(11,14,18,.14),0 12px 34px rgba(91,46,255,.08);backdrop-filter:blur(18px);overflow:hidden;display:none;flex-direction:column;transform-origin:bottom right}.panel.open{display:flex;animation:panel-in .24s cubic-bezier(.2,.8,.2,1)}@keyframes panel-in{from{opacity:0;transform:translateY(14px) scale(.965)}to{opacity:1;transform:none}}' +
    '.head{position:relative;flex:none;background:rgba(255,255,255,.95);color:#0B0E12;padding:12px 14px;border-bottom:1px solid #EFF0F4}.head-row{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:12px}.head-brand{display:flex;min-width:0;align-items:center;gap:10px}.brand-mark{display:inline-flex;width:44px;height:44px;flex:none;align-items:center;justify-content:center;border:0;border-radius:13px;background:#F7F8FA;padding:2px;box-shadow:0 9px 24px -16px rgba(91,46,255,.7);cursor:pointer;transition:.2s}.brand-mark:hover{background:#EDE8FF}.brand-mark:active{transform:scale(.98)}.head-copy{min-width:0}.title{font-size:16px;font-weight:600;line-height:20px;letter-spacing:-.025em;overflow-wrap:anywhere}.subtitle{display:flex;align-items:center;gap:6px;margin-top:2px;color:#5C6272;font-size:13px;font-weight:400;line-height:20px;overflow-wrap:anywhere}.status{width:8px;height:8px;flex:none;border-radius:50%;background:#22C55E;box-shadow:0 0 0 4px rgba(34,197,94,.1)}.subtitle-text{min-width:0;overflow-wrap:anywhere}.head-actions{display:flex;flex:none;align-items:center;gap:8px}.reset,.close{display:grid;place-items:center;border:1px solid #E4E6EC;background:#fff;color:#5C6272;width:40px;height:40px;border-radius:12px;padding:0;cursor:pointer;box-shadow:0 8px 20px -16px rgba(11,14,18,.45);transition:.2s}.reset svg{width:18px;height:18px}.close{color:#0B0E12}.close svg{width:16px;height:16px}.reset:hover,.close:hover{border-color:#CFC5FF;background:#F7F5FF;color:#4A21D6}.reset:active,.close:active{transform:scale(.98)}' +
    '.messages{min-height:0;flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:12px;background:radial-gradient(560px 260px at 88% -8%,rgba(91,46,255,.1),transparent 62%),linear-gradient(180deg,#F7F8FA 0%,rgba(255,255,255,.96) 38%,#fff 100%);overscroll-behavior:contain}.msg{min-width:0;max-width:86%;padding:12px 14px;border-radius:14px;font-size:13px;font-weight:400;line-height:20px;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 16px 35px -32px rgba(11,14,18,.48);animation:message-in .2s ease-out}@keyframes message-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}.assistant{align-self:flex-start;background:#EDE8FF;color:#2A1580;border:1px solid #DDD5FF;border-bottom-left-radius:4px}.user{align-self:flex-end;background:#F1F2F5;color:#0B0E12;border-bottom-right-radius:4px}.notice{margin:auto;text-align:center;color:#5C6272;max-width:270px;font-size:13px;font-weight:600;line-height:1.7}.typing{display:inline-flex;width:max-content;max-width:100%;align-items:center;gap:10px;padding:8px 12px;color:#4A21D6}.typing .nbeh-face{width:32px;height:32px;flex:none;animation:soft-pulse 2.4s ease-in-out infinite}.thought-dots circle{animation:thought-pulse 1.2s infinite}.thought-dots circle:nth-child(2){animation-delay:.15s}.thought-dots circle:nth-child(3){animation-delay:.3s}.typing-label{white-space:nowrap}.dots{display:inline-flex;gap:4px}.dots i{width:6px;height:6px;border-radius:50%;background:#8B76D9;animation:dot-bounce 1s infinite}.dots i:first-child{animation-delay:-.3s}.dots i:nth-child(2){animation-delay:-.15s}@keyframes soft-pulse{50%{transform:scale(1.06);opacity:.82}}@keyframes thought-pulse{50%{opacity:.4}}@keyframes dot-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}.type-caret{display:inline-block;width:4px;height:16px;margin-inline-start:2px;border-radius:999px;background:currentColor;vertical-align:-2px;opacity:.7;animation:caret-pulse 1s infinite}@keyframes caret-pulse{50%{opacity:.25}}' +
    '.composer{flex:none;padding:12px 12px 9px;background:rgba(255,255,255,.95);border-top:1px solid #EFF0F4}.composer-row{display:flex;min-width:0;align-items:center;gap:8px}.input{min-width:0;min-height:44px;flex:1;border:1px solid #E2E4EA;border-radius:12px;padding:0 12px;color:#0B0E12;background:#F7F8FA;outline:none;font-family:inherit;font-size:14px;font-weight:400;line-height:20px;transition:.2s}.input::placeholder{color:#8A8FA0}.input:focus{border-color:#5B2EFF;background:#fff;box-shadow:inset 0 0 0 2px rgba(91,46,255,.08)}.send{display:inline-flex;align-items:center;justify-content:center;flex:none;height:44px;width:auto;border:0;border-radius:12px;background:#5B2EFF;color:#fff;padding:0 16px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;line-height:20px;box-shadow:0 8px 24px rgba(91,46,255,.28);transition:.2s}.send svg{display:none;width:16px;height:16px}.send:hover:not(:disabled){transform:translateY(-2px);background:#4A21D6}.send:active:not(:disabled){transform:translateY(0) scale(.98)}.send:disabled,.input:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}.powered-by{display:block;width:max-content;margin:7px auto 0;color:#756D82;font-size:11px;font-weight:500;line-height:16px;text-decoration:none}.powered-by:hover{color:#5B2EFF;text-decoration:underline;text-underline-offset:2px}.powered-by:focus-visible{border-radius:4px;outline:2px solid #5B2EFF;outline-offset:2px}' +
    '.nbeh-launch.side-left,.panel.side-left,.teaser.side-left{right:auto;left:max(24px,env(safe-area-inset-left))}.teaser.side-left:after{right:auto;left:24px}.panel.side-left{transform-origin:bottom left}:host([dir="rtl"]) .assistant{border-bottom-left-radius:14px;border-bottom-right-radius:4px}:host([dir="rtl"]) .user{border-bottom-right-radius:14px;border-bottom-left-radius:4px}' +
    '@media(min-width:600px) and (max-width:1180px){.nbeh-launch{width:64px;height:64px}.panel{width:clamp(420px,56vw,480px);max-width:calc(100dvw - 48px);height:min(720px,calc(100dvh - 96px));max-height:calc(100dvh - 96px)}}' +
    '@media(min-width:481px) and (max-width:599px){.nbeh-launch{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:64px;height:64px}.teaser{right:max(12px,env(safe-area-inset-right));bottom:max(88px,calc(env(safe-area-inset-bottom) + 76px))}.panel{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:min(380px,calc(100dvw - 24px));max-width:calc(100dvw - 24px);height:min(680px,calc(100dvh - 80px));max-height:calc(100dvh - 80px)}.nbeh-launch.side-left,.panel.side-left,.teaser.side-left{right:auto;left:max(12px,env(safe-area-inset-left))}}' +
    '@media(max-width:480px){.nbeh-launch{right:max(10px,env(safe-area-inset-right));bottom:max(88px,env(safe-area-inset-bottom));width:60px;height:60px;border-radius:20px}.teaser{right:max(10px,env(safe-area-inset-right));bottom:max(160px,calc(env(safe-area-inset-bottom) + 152px));max-width:calc(100dvw - 40px)}.panel,.panel.side-left{right:max(10px,env(safe-area-inset-right));left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom));width:calc(100dvw - 20px);max-width:calc(100dvw - 20px);height:min(680px,calc(100dvh - 80px));max-height:calc(100dvh - 80px);border-radius:24px}.nbeh-launch.side-left,.teaser.side-left{right:auto;left:max(10px,env(safe-area-inset-left))}.head{position:sticky;top:0;z-index:2;padding:18px 12px 10px}.head:before{content:"";position:absolute;top:7px;left:50%;width:46px;height:4px;transform:translateX(-50%);border-radius:999px;background:rgba(92,98,114,.25)}.brand-mark{width:40px;height:40px}.title{font-size:14px}.subtitle{font-size:12px}.subtitle-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reset,.close{width:44px;height:44px;border-radius:14px}.messages{padding:12px}.msg{max-width:92%}.composer{padding:10px 12px max(8px,env(safe-area-inset-bottom))}.send{width:44px;padding:0}.send svg{display:block}.send-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}}' +
    '@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}' +
    '</style><button class="teaser" type="button"></button><button class="nbeh-launch" type="button" aria-expanded="false">' + logoSvg + '</button><section class="panel" role="dialog" aria-modal="false"><header class="head"><div class="head-row"><div class="head-brand"><button class="brand-mark" type="button">' + logoSvg + '</button><div class="head-copy"><div class="title"></div><div class="subtitle"><span class="status" aria-hidden="true"></span><span class="subtitle-text"></span></div></div></div><div class="head-actions"><button class="reset" type="button">' + eraserSvg + '</button><button class="close" type="button">' + closeSvg + '</button></div></div></header><main class="messages"></main><form class="composer"><div class="composer-row"><input class="input" maxlength="1500" autocomplete="off"><button class="send" type="submit">' + sendSvg + '<span class="send-label"></span></button></div><a class="powered-by" target="_blank" rel="noopener noreferrer"></a></form></section>';

  const launch = root.querySelector(".nbeh-launch");
  const teaser = root.querySelector(".teaser");
  const panel = root.querySelector(".panel");
  const brandMark = root.querySelector(".brand-mark");
  const reset = root.querySelector(".reset");
  const close = root.querySelector(".close");
  const messages = root.querySelector(".messages");
  const form = root.querySelector(".composer");
  const input = root.querySelector(".input");
  const send = root.querySelector(".send");
  const sendLabel = root.querySelector(".send-label");
  const poweredBy = root.querySelector(".powered-by");

  const onboardingText = () => {
    const product = displayedProductName();
    const tone = ["neutral_saudi", "warm_concise", "consultative"].includes(preferences.tonePreset) ? preferences.tonePreset : "neutral_saudi";
    const dialect = ["white_saudi", "najdi", "hijazi", "gulf", "modern_standard"].includes(preferences.arabicDialect) ? preferences.arabicDialect : "white_saudi";
    const english = {
      neutral_saudi: "Hi, I’m Nbeh. Ask me anything about {product} and I’ll help you decide if it fits what you need.",
      warm_concise: "Hi! I’m Nbeh 👋 Curious about {product}? Ask me anything and I’ll help you decide.",
      consultative: "Hi, I’m Nbeh. Tell me what matters to you about {product}, and I’ll help you work out whether it’s the right fit.",
    };
    const arabic = {
      white_saudi: { neutral_saudi: "هلا! أنا نبيه. اسألني عن {product} وبساعدك تعرف إذا يناسبك.", warm_concise: "هلا والله 👋 أنا نبيه. ودك تعرف عن {product}؟ اسألني وبساعدك بسرعة.", consultative: "هلا، أنا نبيه. قل لي وش يهمك في {product} وبساعدك تعرف إذا هو الأنسب لك." },
      najdi: { neutral_saudi: "هلا والله! أنا نبيه. اسألني عن {product} وأبشر أساعدك تعرف إذا يناسبك.", warm_concise: "يا هلا 👋 أنا نبيه. ودك تعرف عن {product}؟ أبشر باللي يفيدك.", consultative: "يا هلا، أنا نبيه. علّمني وش يهمك في {product} وأساعدك تعرف إذا هو الأنسب لك." },
      hijazi: { neutral_saudi: "أهلين! أنا نبيه. اسألني عن {product} وأساعدك تعرف إذا يناسبك.", warm_concise: "أهلين وسهلين 👋 أنا نبيه. حاب تعرف عن {product}؟ اسألني.", consultative: "أهلين، أنا نبيه. قل لي إيش يهمك في {product} وأساعدك تعرف إذا يناسب احتياجك." },
      gulf: { neutral_saudi: "هلا بك! أنا نبيه. اسألني عن {product} وبساعدك تشوف إذا يناسبك.", warm_concise: "هلا وغلا 👋 أنا نبيه. تبي تعرف عن {product}؟ اسألني.", consultative: "هلا بك، أنا نبيه. خبرني شنو يهمك في {product} وبساعدك تعرف إذا يناسبك." },
      modern_standard: { neutral_saudi: "مرحبًا، أنا نبيه. اسألني عن {product} وسأساعدك في معرفة ما إذا كان مناسبًا لك.", warm_concise: "مرحبًا 👋 أنا نبيه. هل تريد معرفة المزيد عن {product}؟ اسألني.", consultative: "مرحبًا، أنا نبيه. أخبرني بما يهمك في {product} وسأساعدك في معرفة مدى ملاءمته لاحتياجك." },
    };
    const template = lang === "ar" ? arabic[dialect][tone] : english[tone];
    return template.replaceAll("{product}", product);
  };

  const contextStorageKey = () => "nbeh:salla:chat:" + merchantKey + ":" + (currentProduct || "store");
  const storableMessages = () => Array.from(messages.querySelectorAll(".msg:not(.typing):not(.notice)")).slice(-30).map((node) => ({
    role: node.classList.contains("user") ? "user" : "assistant",
    content: String(node.dataset.content || node.textContent || "").trim().slice(0, 2400),
  })).filter((message) => message.content);
  const saveChat = () => {
    const storedMessages = storableMessages();
    if (!storedMessages.some((message) => message.role === "user")) return;
    try {
      sessionStorage.setItem(contextStorageKey(), JSON.stringify({ conversationId: conversationId || "", messages: storedMessages }));
    } catch {}
  };
  const restoreChat = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(contextStorageKey()) || "null");
      if (!stored || !Array.isArray(stored.messages) || !stored.messages.some((message) => message?.role === "user")) return false;
      conversationId = typeof stored.conversationId === "string" ? stored.conversationId.slice(0, 160) || null : null;
      stored.messages.slice(-30).forEach((message) => {
        if ((message?.role === "user" || message?.role === "assistant") && typeof message.content === "string") {
          addMessage(message.role, message.content.slice(0, 2400));
        }
      });
      return messages.childElementCount > 0;
    } catch {
      return false;
    }
  };
  const clearStoredChat = () => {
    try { sessionStorage.removeItem(contextStorageKey()); } catch {}
  };
  const animateMessage = (item, text) => new Promise((resolve) => {
    const safeText = String(text || "");
    item.dataset.content = safeText;
    if (!safeText || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      item.textContent = safeText;
      messages.scrollTop = messages.scrollHeight;
      resolve();
      return;
    }
    let index = 0;
    const step = Math.max(1, Math.ceil(safeText.length / 140));
    const caret = document.createElement("span");
    caret.className = "type-caret";
    const timer = setInterval(() => {
      index = Math.min(safeText.length, index + step);
      item.textContent = safeText.slice(0, index);
      if (index < safeText.length) item.appendChild(caret);
      messages.scrollTop = messages.scrollHeight;
      if (index >= safeText.length) {
        clearInterval(timer);
        resolve();
      }
    }, 18);
  });
  const addMessage = (role, text, extra, animate) => {
    const item = document.createElement("div");
    item.className = "msg " + role + (extra ? " " + extra : "");
    item.dataset.content = String(text || "");
    if (!animate) item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    if (animate) void animateMessage(item, text);
    return item;
  };
  const syncComposer = () => {
    send.disabled = input.disabled || !input.value.trim();
  };
  const renderContext = () => {
    lang = locale();
    currentProduct = productRef();
    root.querySelector(".title").textContent = t().title;
    const displayedProduct = displayedProductName();
    root.querySelector(".subtitle-text").textContent = t().productGuide.replaceAll("{product}", displayedProduct || t().storeProducts);
    launch.setAttribute("aria-label", t().open);
    launch.setAttribute("title", t().open);
    close.setAttribute("aria-label", t().close);
    close.setAttribute("title", t().close);
    reset.setAttribute("aria-label", t().reset);
    reset.setAttribute("title", t().reset);
    brandMark.setAttribute("aria-label", t().download);
    brandMark.setAttribute("title", t().download);
    input.placeholder = t().placeholder;
    input.setAttribute("aria-label", t().placeholder);
    send.setAttribute("aria-label", t().send);
    send.setAttribute("title", t().send);
    sendLabel.textContent = t().send;
    poweredBy.textContent = t().poweredBy;
    poweredBy.href = origin + "/";
    host.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    const side = lang === "ar" ? preferences.positionAr : preferences.positionEn;
    launch.classList.toggle("side-left", side === "left");
    panel.classList.toggle("side-left", side === "left");
    teaser.classList.toggle("side-left", side === "left");
    teaser.textContent = lang === "ar" ? preferences.teaserMessageAr : preferences.teaserMessageEn;
    teaser.setAttribute("aria-label", teaser.textContent ? teaser.textContent + " — " + t().open : t().open);
    teaser.hidden = panel.classList.contains("open") || !teaser.textContent;
    if (!messages.childElementCount) {
      if (restoreChat()) {
        syncComposer();
        return;
      }
      addMessage("assistant", onboardingText(), "onboarding", true);
      if (!currentProduct) addMessage("notice", t().noProduct);
    }
    syncComposer();
  };

  const openPanel = (automatic) => {
    renderContext();
    panel.classList.add("open");
    launch.setAttribute("aria-expanded", "true");
    teaser.hidden = true;
    if (window.matchMedia("(max-width: 480px)").matches) {
      host.dataset.bodyOverflow = document.body.style.overflow;
      host.dataset.htmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    if (!automatic) setTimeout(() => input.focus(), 50);
    if (!automatic) trackEvent("chat_opened");
  };
  const scheduleAutoPopup = () => {
    if (autoPopupTimer) clearTimeout(autoPopupTimer);
    if (!preferences.autoPopupEnabled || panel.classList.contains("open")) return;
    autoPopupTimer = setTimeout(() => openPanel(true), Math.max(0, Math.min(60, Number(preferences.autoPopupDelaySeconds) || 0)) * 1000);
  };
  const loadPreferences = async () => {
    try {
      const response = await fetch(origin + "/api/widget/preferences?merchantKey=" + encodeURIComponent(merchantKey), { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        preferences = { ...preferences, ...payload };
      }
      const onboarding = messages.querySelector(".onboarding");
      if (onboarding && !messages.querySelector(".user")) {
        onboarding.dataset.content = onboardingText();
        onboarding.textContent = onboardingText();
      }
      renderContext();
      trackEvent("product_page_view");
      trackEvent("widget_impression");
    } catch {} finally {
      scheduleAutoPopup();
    }
  };
  const loadProductConfig = async (attempts = 1) => {
    productConfigReady = false;
    productConfigFailure = "temporary";
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(origin + "/api/widget/config?merchantKey=" + encodeURIComponent(merchantKey) + "&productRef=" + encodeURIComponent(currentProduct), { cache: "no-store" });
        if (!response.ok) {
          productConfigFailure = response.status === 404 ? "product_missing" : "temporary";
        } else {
          const payload = await response.json();
          productConfigReady = Boolean(payload.product?.ref);
          canonicalProductName = clean(lang === "ar" ? (payload.product?.arabicName || payload.product?.name) : payload.product?.name);
          const onboarding = messages.querySelector(".onboarding");
          if (onboarding && !messages.querySelector(".user")) {
            onboarding.dataset.content = onboardingText();
            onboarding.textContent = onboardingText();
          }
          renderContext();
          return productConfigReady;
        }
      } catch {
        productConfigFailure = "temporary";
      }
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
    return false;
  };

  launch.addEventListener("click", () => openPanel(false));
  teaser.addEventListener("click", () => openPanel(false));
  brandMark.addEventListener("click", () => {
    const transcript = storableMessages().map((message) => (message.role === "assistant" ? "Agent" : "User") + ": " + message.content).join("\n\n");
    if (!transcript) return;
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nbeh-" + (currentProduct || "store").replace(/[^a-zA-Z0-9_-]+/g, "-") + "-" + new Date().toISOString().slice(0, 10) + ".txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  reset.addEventListener("click", () => {
    clearStoredChat();
    conversationId = null;
    messages.replaceChildren();
    renderContext();
    input.value = "";
    syncComposer();
    input.focus();
  });
  const closePanel = () => {
    panel.classList.remove("open");
    launch.setAttribute("aria-expanded", "false");
    document.body.style.overflow = host.dataset.bodyOverflow || "";
    document.documentElement.style.overflow = host.dataset.htmlOverflow || "";
    renderContext();
  };
  close.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.classList.contains("open")) closePanel();
  });
  input.addEventListener("input", syncComposer);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    renderContext();
    const message = input.value.trim();
    if (!message) return;
    addMessage("user", message);
    input.value = "";
    syncComposer();
    if (!currentProduct) {
      const guidance = addMessage("assistant", t().noProduct, "", true);
      guidance.setAttribute("aria-live", "polite");
      input.focus();
      return;
    }
    if (!productConfigReady && !(await loadProductConfig(2))) {
      const guidance = addMessage("assistant", productConfigFailure === "product_missing" ? t().productUnavailable : t().catalogTemporarilyUnavailable, "", true);
      guidance.setAttribute("aria-live", "polite");
      input.focus();
      return;
    }
    input.disabled = true;
    syncComposer();
    const typing = addMessage("assistant", "", "typing");
    typing.innerHTML = thinkingLogoSvg + '<span class="typing-label">' + t().thinking + '</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    try {
      const history = Array.from(messages.querySelectorAll(".msg:not(.typing):not(.notice)")).slice(-20).map((node) => ({
        role: node.classList.contains("user") ? "user" : "assistant",
        content: node.textContent || "",
      }));
      const response = await fetch(origin + "/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantKey,
          productSlug: currentProduct,
          message,
          ...(conversationId ? { conversationId } : {}),
          visitorRef,
          locale: lang,
          conversationHistory: history,
          pageContext: { url: location.href, path: location.pathname, title: document.title, productName: displayedProductName(), locale: lang },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.answer) throw new Error("agent_unavailable");
      conversationId = payload.conversationId || conversationId;
      typing.classList.remove("typing");
      await animateMessage(typing, payload.answer);
    } catch {
      typing.classList.remove("typing");
      await animateMessage(typing, t().error);
    } finally {
      saveChat();
      input.disabled = false;
      syncComposer();
      input.focus();
    }
  });

  renderContext();
  void loadPreferences();
  void loadProductConfig();
  trackEvent("product_page_view");
  trackEvent("widget_impression");
  window.addEventListener("popstate", renderContext);
  document.addEventListener("salla::product::details::loaded", renderContext);
  new MutationObserver(() => {
    const nextProduct = productRef();
    if (nextProduct && nextProduct !== currentProduct) {
      currentProduct = nextProduct;
      productConfigReady = false;
      conversationId = null;
      messages.replaceChildren();
      renderContext();
      void loadProductConfig();
      trackEvent("product_page_view");
      trackEvent("widget_impression");
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  };
  const start = () => { if (isProductPage()) mount(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  document.addEventListener("salla::product::details::loaded", start);
})();`;

export function GET() {
  return new NextResponse(loader, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "cross-origin-resource-policy": "cross-origin",
      "x-content-type-options": "nosniff",
    },
  });
}
