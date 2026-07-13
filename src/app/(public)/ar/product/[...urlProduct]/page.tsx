import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoProductPage } from "@/components/saleh-demo/DemoProductPage";
import { getDemoProductBySlug } from "@/data/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ urlProduct: string[] }>;
}): Promise<Metadata> {
  const { urlProduct } = await params;
  const fullPath = urlProduct.join("/");
  const product = getDemoProductBySlug(fullPath);
  return {
    title: product ? `${product.name} | Maison Vert` : "Product | Maison Vert",
    description: product?.shortDescription,
  };
}

export default async function ArabicProductPage({
  params,
}: {
  params: Promise<{ urlProduct: string[] }>;
}) {
  const { urlProduct } = await params;
  const fullPath = urlProduct.join("/");
  const product = getDemoProductBySlug(fullPath);
  if (!product) notFound();
  return <DemoProductPage product={product} />;
}
