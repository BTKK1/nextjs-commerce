import Link from "next/link";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";

interface PaginationProps {
  basePath: string;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  query?: Record<string, string>;
}

function pageHref(basePath: string, query: Record<string, string>, page: number) {
  const params = new URLSearchParams(query);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function Pagination({ basePath, currentPage, pageSize, totalItems, query = {} }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);
  const linkClass = "focus-ring rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-stone-400 hover:bg-stone-50";
  const disabledClass = "cursor-not-allowed rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-400";

  return (
    <DashboardTranslatedServer><nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-stone-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-stone-600" aria-live="polite">
        Showing {firstItem}–{lastItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        {safePage > 1 ? (
          <Link href={pageHref(basePath, query, safePage - 1)} className={linkClass}>Previous</Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>Previous</span>
        )}
        <span className="min-w-24 text-center text-sm text-stone-600">Page {safePage} of {totalPages}</span>
        {safePage < totalPages ? (
          <Link href={pageHref(basePath, query, safePage + 1)} className={linkClass}>Next</Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>Next</span>
        )}
      </div>
    </nav></DashboardTranslatedServer>
  );
}
