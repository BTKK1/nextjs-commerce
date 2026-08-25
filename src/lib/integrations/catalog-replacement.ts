import "server-only";
import { catalogProductToSupabaseRow } from "@/lib/catalog/supabase-mapper";
import type { CatalogProduct } from "@/lib/types";
import { createServiceClient } from "@/utils/supabase/server";

export type CommerceCatalogPlatform = "salla" | "zid";

/**
 * Replaces one provider's catalog after a completed full synchronization.
 * Products from other providers owned by the same merchant are untouched.
 */
export async function replaceCommerceProducts(
  merchantId: string,
  platform: CommerceCatalogPlatform,
  products: CatalogProduct[],
): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("id,slug")
    .eq("merchant_id", merchantId)
    .eq("platform", platform);
  if (existingError) throw existingError;

  if (products.length) {
    const { error: productError } = await supabase.from("products").upsert(
      products.map((product) => catalogProductToSupabaseRow(product, merchantId, platform)),
      { onConflict: "merchant_id,platform,slug" },
    );
    if (productError) throw productError;
  }

  const currentSlugs = new Set(products.map((product) => product.slug));
  const staleIds = (existing ?? [])
    // The database conflict key is merchant + platform + slug. A marketplace
    // product can keep its external ID while its public slug changes, so the
    // old slug must still be removed after the new row is upserted.
    .filter((row) => !currentSlugs.has(String(row.slug)))
    .map((row) => row.id);

  for (let index = 0; index < staleIds.length; index += 100) {
    const { error: deleteError } = await supabase.from("products")
      .delete()
      .eq("merchant_id", merchantId)
      .eq("platform", platform)
      .in("id", staleIds.slice(index, index + 100));
    if (deleteError) throw deleteError;
  }
}
