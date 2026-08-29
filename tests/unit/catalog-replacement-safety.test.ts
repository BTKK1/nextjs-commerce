import { describe, expect, it } from "vitest";
import { assertCatalogSnapshotSafe } from "@/lib/integrations/catalog-safety";

describe("commerce catalog replacement safety", () => {
  it("retains a previously healthy catalog when a provider returns an empty snapshot", () => {
    expect(() => assertCatalogSnapshotSafe("salla", 20, 0)).toThrow(/previous synchronized catalog was retained/i);
    expect(() => assertCatalogSnapshotSafe("zid", 38, 0)).toThrow(/previous synchronized catalog was retained/i);
  });

  it("allows empty new stores and completed non-empty snapshots", () => {
    expect(() => assertCatalogSnapshotSafe("salla", 0, 0)).not.toThrow();
    expect(() => assertCatalogSnapshotSafe("zid", 38, 39)).not.toThrow();
  });
});
