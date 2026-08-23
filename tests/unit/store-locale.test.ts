import { describe, expect, it } from "vitest";
import { getLanguageRoutes, localeFromStorePath, localizeStorePath, stripStoreLocalePrefix } from "@/components/saleh-demo/store-i18n";

describe("store locale routing", () => {
  it("derives the active store locale from the route prefix", () => {
    expect(localeFromStorePath("/store")).toBe("en");
    expect(localeFromStorePath("/store/product/everyday-leather-tote")).toBe("en");
    expect(localeFromStorePath("/ar/store")).toBe("ar");
    expect(localeFromStorePath("/ar/store/product/everyday-leather-tote")).toBe("ar");
  });

  it("strips and reapplies the Arabic route prefix without changing the product path", () => {
    expect(stripStoreLocalePrefix("/ar/store/product/everyday-leather-tote")).toBe("/store/product/everyday-leather-tote");
    expect(localizeStorePath("/product/everyday-leather-tote", "ar")).toBe("/ar/store/product/everyday-leather-tote");
    expect(localizeStorePath("/ar/store/product/everyday-leather-tote", "en")).toBe("/store/product/everyday-leather-tote");
    expect(localizeStorePath("/#collection", "ar")).toBe("/ar/store#collection");
  });

  it("computes Ting-style language switch routes from the active pathname", () => {
    expect(getLanguageRoutes("/store/product/everyday-leather-tote")).toEqual({
      isArabic: false,
      englishPath: "/store/product/everyday-leather-tote",
      arabicPath: "/ar/store/product/everyday-leather-tote",
    });
    expect(getLanguageRoutes("/ar/store/product/everyday-leather-tote")).toEqual({
      isArabic: true,
      englishPath: "/store/product/everyday-leather-tote",
      arabicPath: "/ar/store/product/everyday-leather-tote",
    });
  });
});
