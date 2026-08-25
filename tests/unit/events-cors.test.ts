import { describe, expect, it } from "vitest";
import { OPTIONS } from "@/app/api/events/route";

describe("storefront analytics CORS", () => {
  it("accepts the JSON preflight used by Salla and Zid storefront widgets", () => {
    const response = OPTIONS(new Request("https://www.nbeh.io/api/events", {
      method: "OPTIONS",
      headers: { origin: "https://merchant.zid.store", "access-control-request-method": "POST" },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://merchant.zid.store");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-headers")).toContain("Content-Type");
  });
});
