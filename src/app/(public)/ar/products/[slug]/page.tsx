import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoProductPage } from "@/components/saleh-demo/DemoProductPage";
import { getDemoProductBySlug } from "@/data/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getDemoProductBySlug(slug);
  return {
    title: product ? `${product.name} | Maison Vert` : "Product | Maison Vert",
    description: product?.shortDescription,
  };
}

export default async function ArabicProductAliasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getDemoProductBySlug(slug);
  if (!product) notFound();
  return <DemoProductPage product={product} />;
}
