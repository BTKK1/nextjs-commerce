import { expect, test, type Page } from "@playwright/test";

type Platform = "salla" | "zid";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

async function mockNbehApi(
  page: Page,
  preferences: Record<string, unknown>,
  product: { name: string; arabicName: string },
) {
  await page.route("https://www.nbeh.io/api/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = {
      "access-control-allow-origin": "*",
      "content-type": "application/json; charset=utf-8",
    };

    if (url.pathname === "/api/widget/preferences") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(preferences) });
      return;
    }
    if (url.pathname === "/api/widget/config") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ product }) });
      return;
    }
    if (url.pathname === "/api/agent/chat") {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ answer: "This is the verified Nbeh test reply.", conversationId: "conversation-e2e" }),
      });
      return;
    }
    if (url.pathname === "/api/events") {
      await route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" }, body: "" });
      return;
    }
    if (url.pathname === "/api/widget/font") {
      await route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "" });
      return;
    }

    await route.fulfill({ status: 404, headers, body: "{}" });
  });
}

async function installLoader(
  page: Page,
  platform: Platform,
  options: { language: "ar" | "en"; product?: { ref: string; name: string } },
) {
  await page.evaluate(
    ({ loaderUrl, language, product }) => {
      const script = document.createElement("script");
      script.id = "nbeh-salla-agent";
      script.src = loaderUrl;
      script.dataset.storeId = "storefront-e2e";
      script.dataset.locale = language;
      if (product) {
        script.dataset.productRef = product.ref;
        script.dataset.productName = product.name;
      }
      document.body.appendChild(script);
    },
    { loaderUrl: `${baseUrl}/${platform}-widget.js`, language: options.language, product: options.product },
  );
}

for (const platform of ["salla", "zid"] as const) {
  test(`${platform} loader stays absent outside product pages`, async ({ page }) => {
    await page.setContent("<!doctype html><html lang='en'><body><main><h1>Store home</h1></main></body></html>");
    await installLoader(page, platform, { language: "en" });

    await page.waitForTimeout(300);
    await expect(page.locator("#nbeh-salla-agent-host")).toHaveCount(0);
  });
}

test("Salla loader applies Arabic-left settings, names the product, auto-opens, and sends", async ({ page }) => {
  await mockNbehApi(
    page,
    {
      tonePreset: "warm_concise",
      arabicDialect: "white_saudi",
      positionAr: "left",
      positionEn: "right",
      autoPopupEnabled: true,
      autoPopupDelaySeconds: 0,
      teaserMessageAr: "محتار؟ اسأل نبيه عن المنتج",
      teaserMessageEn: "Need help choosing? Ask Nbeh",
    },
    { name: "Everyday Leather Tote", arabicName: "حقيبة الجلد اليومية" },
  );
  await page.setContent("<!doctype html><html lang='ar' dir='rtl'><body><h1>حقيبة الجلد اليومية</h1></body></html>");
  await installLoader(page, "salla", {
    language: "ar",
    product: { ref: "everyday-leather-tote", name: "حقيبة الجلد اليومية" },
  });

  const host = page.locator("#nbeh-salla-agent-host");
  await expect(host).toBeAttached();
  await expect(host.locator(".panel")).toHaveClass(/open/);
  await expect(host.locator(".panel")).toHaveClass(/side-left/);
  await expect(host.locator(".nbeh-launch")).toHaveClass(/side-left/);
  await expect(host.locator(".onboarding")).toContainText("حقيبة الجلد اليومية");
  await expect(host.locator(".powered-by")).toHaveText("مدعوم من نبيه");

  await host.locator(".input").fill("هل تناسب الاستخدام اليومي؟");
  await host.locator(".send").click();
  await expect(host.locator(".user")).toContainText("هل تناسب الاستخدام اليومي؟");
  await expect(host.locator(".assistant").last()).toContainText("verified Nbeh test reply");
});

test("Zid loader applies English-right settings, exposes the teaser, names the product, and sends", async ({ page }) => {
  await mockNbehApi(
    page,
    {
      tonePreset: "consultative",
      arabicDialect: "white_saudi",
      positionAr: "left",
      positionEn: "right",
      autoPopupEnabled: false,
      autoPopupDelaySeconds: 0,
      teaserMessageAr: "محتار؟ اسأل نبيه عن المنتج",
      teaserMessageEn: "Need help choosing? Ask Nbeh",
    },
    { name: "Everyday Leather Tote", arabicName: "حقيبة الجلد اليومية" },
  );
  await page.setContent("<!doctype html><html lang='en' dir='ltr'><body><h1>Everyday Leather Tote</h1></body></html>");
  await installLoader(page, "zid", {
    language: "en",
    product: { ref: "everyday-leather-tote", name: "Everyday Leather Tote" },
  });

  const host = page.locator("#nbeh-salla-agent-host");
  await expect(host).toBeAttached();
  await expect(host.locator(".panel")).not.toHaveClass(/open/);
  await expect(host.locator(".panel")).not.toHaveClass(/side-left/);
  await expect(host.locator(".teaser")).toBeVisible();
  await expect(host.locator(".teaser")).toHaveText("Need help choosing? Ask Nbeh");
  await host.locator(".teaser").click();
  await expect(host.locator(".panel")).toHaveClass(/open/);
  await expect(host.locator(".onboarding")).toContainText("Everyday Leather Tote");
  await expect(host.locator(".powered-by")).toHaveText("Powered by Nbeh");

  await host.locator(".input").fill("Is it suitable for everyday use?");
  await host.locator(".send").click();
  await expect(host.locator(".user")).toContainText("Is it suitable for everyday use?");
  await expect(host.locator(".assistant").last()).toContainText("verified Nbeh test reply");
});
