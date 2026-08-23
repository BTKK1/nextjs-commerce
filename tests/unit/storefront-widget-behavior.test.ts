import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { GET as getWidgetLoader } from "@/app/salla-widget.js/route";

const openDoms: JSDOM[] = [];

afterEach(() => {
  openDoms.splice(0).forEach((dom) => dom.window.close());
});

async function mountWidget(language: "ar" | "en", preferences: Record<string, unknown>) {
  const dom = new JSDOM(`<!doctype html><html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"><body><h1>Test product</h1><script id="nbeh-salla-agent" src="https://www.nbeh.io/zid-widget.js"></script></body></html>`, {
    url: "https://store.example/products/test-product",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  openDoms.push(dom);
  const browser = dom.window as unknown as Window & typeof globalThis;
  const script = browser.document.getElementById("nbeh-salla-agent") as HTMLScriptElement;
  script.dataset.storeId = "store-12345";
  script.dataset.productRef = "product-123";
  script.dataset.productName = language === "ar" ? "منتج الاختبار" : "Test product";
  script.dataset.locale = language;
  browser.matchMedia = (() => ({ matches: false, media: "", onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof browser.matchMedia;
  browser.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/widget/preferences")) return Response.json(preferences);
    if (url.includes("/api/widget/config")) return Response.json({ product: { ref: "product-123", name: "Test product", arabicName: "منتج الاختبار" } });
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  browser.eval(await getWidgetLoader().text());
  await new Promise((resolve) => setTimeout(resolve, 40));
  const host = browser.document.getElementById("nbeh-salla-agent-host");
  expect(host?.shadowRoot).toBeTruthy();
  return host!.shadowRoot!;
}

describe("shared Salla and Zid storefront widget behavior", () => {
  it("applies the saved Arabic side and automatically opens after the configured delay", async () => {
    const root = await mountWidget("ar", {
      positionAr: "left",
      positionEn: "right",
      autoPopupEnabled: true,
      autoPopupDelaySeconds: 0,
      teaserMessageAr: "اسأل نبيه عن المنتج",
      teaserMessageEn: "Ask Nbeh about this product",
    });

    expect(root.querySelector(".nbeh-launch")?.classList.contains("side-left")).toBe(true);
    expect(root.querySelector(".panel")?.classList.contains("side-left")).toBe(true);
    expect(root.querySelector(".panel")?.classList.contains("open")).toBe(true);
    expect((root.querySelector(".teaser") as HTMLButtonElement).hidden).toBe(true);
    expect(root.querySelector(".powered-by")?.textContent).toBe("مدعوم من نبيه");
    expect((root.querySelector(".powered-by") as HTMLAnchorElement).href).toBe("https://www.nbeh.io/");
  });

  it("uses the independent English side and lets the closed-widget message open the chat", async () => {
    const root = await mountWidget("en", {
      positionAr: "right",
      positionEn: "left",
      autoPopupEnabled: false,
      autoPopupDelaySeconds: 0,
      teaserMessageAr: "اسأل نبيه عن المنتج",
      teaserMessageEn: "Ask Nbeh about this product",
    });

    const teaser = root.querySelector(".teaser") as HTMLButtonElement;
    expect(root.querySelector(".panel")?.classList.contains("open")).toBe(false);
    expect(root.querySelector(".nbeh-launch")?.classList.contains("side-left")).toBe(true);
    expect(teaser.hidden).toBe(false);
    expect(teaser.textContent).toBe("Ask Nbeh about this product");
    teaser.click();
    expect(root.querySelector(".panel")?.classList.contains("open")).toBe(true);
    expect(root.querySelector(".powered-by")?.textContent).toBe("Powered by Nbeh");
  });
});
