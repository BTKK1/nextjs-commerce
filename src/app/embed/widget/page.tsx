import { AgentWidget } from "@/components/saleh-demo/AgentWidget";
import { loadSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { isValidWidgetMerchantKey } from "@/lib/widget/identity";

export const dynamic = "force-dynamic";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function EmbeddedWidgetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const merchantKey = param(query.merchantKey);
  const productRef = param(query.productRef);
  const locale = param(query.locale) === "ar" ? "ar" : "en";
  if (!isValidWidgetMerchantKey(merchantKey) || !/^[a-zA-Z0-9_-]{1,160}$/.test(productRef)) {
    return <main className="sr-only">Nbeh widget configuration is invalid.</main>;
  }
  const knowledge = await loadSellerKnowledgeForProduct(productRef, merchantKey);
  if (!knowledge) return <main className="sr-only">Product or merchant was not found.</main>;
  return (
    <main className="min-h-screen bg-transparent">
      <AgentWidget
        merchantKey={merchantKey}
        merchantName={knowledge.merchant.name}
        productSlug={knowledge.currentProduct.slug}
        productName={locale === "ar" ? knowledge.currentProduct.arabicName || knowledge.currentProduct.name : knowledge.currentProduct.name}
        locale={locale}
        trackProductView
      />
    </main>
  );
}
