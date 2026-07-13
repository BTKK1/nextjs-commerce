import OpenGraphImage from "@components/common/OpenGraphImage";

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function Image({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  return OpenGraphImage({ title: titleFromSlug(page) || "Maison Vert" });
}
