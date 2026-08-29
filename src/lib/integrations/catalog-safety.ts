export type CommerceCatalogPlatform = "salla" | "zid";

export function assertCatalogSnapshotSafe(
  platform: CommerceCatalogPlatform,
  existingCount: number,
  incomingCount: number,
): void {
  if (existingCount > 0 && incomingCount === 0) {
    throw new Error(`${platform} returned an empty catalog snapshot; the previous synchronized catalog was retained.`);
  }
}
