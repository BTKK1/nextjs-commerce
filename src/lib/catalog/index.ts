import { DemoCatalogProvider } from "@/lib/catalog/demo-provider";
import type { CatalogProvider } from "@/lib/catalog/provider";
import { SallaCatalogProvider } from "@/lib/catalog/salla-provider";
import { ZidCatalogProvider } from "@/lib/catalog/zid-provider";
import type { PlatformProvider } from "@/lib/types";

export function getCatalogProvider(provider: PlatformProvider = "demo_catalog"): CatalogProvider {
  if (provider === "salla") {
    return new SallaCatalogProvider();
  }

  if (provider === "zid") {
    return new ZidCatalogProvider();
  }

  return new DemoCatalogProvider();
}

export function listCatalogProviders(): CatalogProvider[] {
  return [new DemoCatalogProvider(), new SallaCatalogProvider(), new ZidCatalogProvider()];
}

export const demoCatalogProvider = new DemoCatalogProvider();
