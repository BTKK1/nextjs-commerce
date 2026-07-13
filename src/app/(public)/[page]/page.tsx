import type { Metadata } from "next";

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  const title = titleFromSlug(page) || "Store Page";

  return {
    title: `${title} | Maison Vert`,
    description: "A local placeholder for Bagisto CMS content in the Maison Vert storefront.",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const title = titleFromSlug(page) || "Store Page";

  return (
    <main className="mx-auto min-h-screen max-w-screen-md px-4 py-12 xss:px-7.5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Bagisto CMS placeholder</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{title}</h1>
      <div className="mt-6 rounded-md border border-stone-200 bg-white p-6 text-stone-700 shadow-sm">
        <p>
          This page is served locally for the Maison Vert demo. Connect a Bagisto backend to replace this
          placeholder with live CMS content.
        </p>
      </div>
    </main>
  );
}
