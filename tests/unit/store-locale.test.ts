import { describe, expect, it } from "vitest";
import { getLanguageRoutes, localeFromStorePath, localizeStorePath, stripStoreLocalePrefix } from "@/components/saleh-demo/store-i18n";

describe("store locale routing", () => {
  it("derives the active store locale from the route prefix", () => {
    expect(localeFromStorePath("/")).toBe("en");
    expect(localeFromStorePath("/product/everyday-leather-tote")).toBe("en");
    expect(localeFromStorePath("/ar")).toBe("ar");
    expect(localeFromStorePath("/ar/product/everyday-leather-tote")).toBe("ar");
  });

  it("strips and reapplies the Arabic route prefix without changing the product path", () => {
    expect(stripStoreLocalePrefix("/ar/product/everyday-leather-tote")).toBe("/product/everyday-leather-tote");
    expect(localizeStorePath("/product/everyday-leather-tote", "ar")).toBe("/ar/product/everyday-leather-tote");
    expect(localizeStorePath("/ar/product/everyday-leather-tote", "en")).toBe("/product/everyday-leather-tote");
    expect(localizeStorePath("/#collection", "ar")).toBe("/ar#collection");
  });

  it("computes Ting-style language switch routes from the active pathname", () => {
    expect(getLanguageRoutes("/product/everyday-leather-tote")).toEqual({
      isArabic: false,
      englishPath: "/product/everyday-leather-tote",
      arabicPath: "/ar/product/everyday-leather-tote",
    });
    expect(getLanguageRoutes("/ar/product/everyday-leather-tote")).toEqual({
      isArabic: true,
      englishPath: "/product/everyday-leather-tote",
      arabicPath: "/ar/product/everyday-leather-tote",
    });
  });
});
