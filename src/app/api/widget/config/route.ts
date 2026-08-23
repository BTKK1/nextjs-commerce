import { NextResponse } from "next/server";
import { z } from "zod";
import { loadSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import { WIDGET_MERCHANT_KEY_PATTERN } from "@/lib/widget/identity";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  merchantKey: z.string().regex(WIDGET_MERCHANT_KEY_PATTERN),
  productRef: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
});

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return {};
    return { "Access-Control-Allow-Origin": parsed.origin, Vary: "Origin" };
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const headers = corsHeaders(request);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ merchantKey: url.searchParams.get("merchantKey"), productRef: url.searchParams.get("productRef") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid widget configuration" }, { status: 400, headers });
  const knowledge = await loadSellerKnowledgeForProduct(parsed.data.productRef, parsed.data.merchantKey);
  if (!knowledge) return NextResponse.json({ error: "Merchant or product not found" }, { status: 404, headers });
  return NextResponse.json({
    assistant: { name: "Nbeh", arabicName: "نبيه" },
    merchant: { publicKey: knowledge.merchant.publicKey, displayName: knowledge.merchant.name },
    product: { ref: knowledge.currentProduct.slug, name: knowledge.currentProduct.name, arabicName: knowledge.currentProduct.arabicName, image: knowledge.currentProduct.imagePath },
    catalogProvider: knowledge.provider,
    localePolicy: "match_shopper",
    capabilities: { groundedCatalogAnswers: true, conversationLogging: true, insights: true },
  }, { headers: { ...headers, "cache-control": "private, max-age=60", "x-content-type-options": "nosniff" } });
}
