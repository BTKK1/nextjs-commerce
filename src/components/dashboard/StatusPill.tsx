export function StatusPill({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">None</span>;
  }

  const tone = value.includes("not_connected") || value.includes("disabled")
    ? "bg-stone-100 text-stone-700"
    : value.includes("connected")
      ? "bg-emerald-50 text-qahwa"
      : value.includes("missing") || value.includes("fallback")
      ? "bg-amber-50 text-amber-800"
      : "bg-stone-100 text-stone-700";

  return <span className={`rounded-md px-2 py-1 text-xs font-medium ${tone}`}>{value.replaceAll("_", " ")}</span>;
}
