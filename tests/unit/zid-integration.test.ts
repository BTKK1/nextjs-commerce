import { describe, expect, it } from "vitest";
import { normalizeZidStoreProfile } from "@/lib/integrations/zid-client";

describe("Zid store identity", () => {
  it("keeps both the manager API ID and storefront UUID", () => {
    expect(normalizeZidStoreProfile({
      user: {
        email: "owner@example.test",
        store: {
          id: 3220733,
          uuid: "a28ee8e8-4267-4514-bbf8-b277d07040d0",
          title: "Nbeh Demo Store",
          url: "https://npx6j8.zid.store/",
        },
      },
    })).toEqual({
      storeId: "3220733",
      storeUuid: "a28ee8e8-4267-4514-bbf8-b277d07040d0",
      name: "Nbeh Demo Store",
      email: "owner@example.test",
      url: "https://npx6j8.zid.store/",
    });
  });
});
