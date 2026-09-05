import Link from "next/link";
import { pageHref } from "@/lib/pagination";

type PaginationControlProps = {
  basePath: string;
  paramName: string;
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  paginationLabel: string;
  previousLabel: string;
  nextLabel: string;
  pageLabel: (page: number) => string;
  summary?: string;
};

export function PaginationControl({
  basePath,
  paramName,
  currentPage,
  totalPages,
  searchParams,
  paginationLabel,
  previousLabel,
  nextLabel,
  pageLabel,
  summary,
}: PaginationControlProps) {
  if (totalPages <= 1) {
    return summary ? <p className="mt-4 text-[length:var(--text-sm)] text-muted">{summary}</p> : null;
  }

  const hrefForPage = (page: number) =>
    pageHref(basePath, paramName, page, searchParams);

  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;
  const pageItems = pageWindow(currentPage, totalPages);

  return (
    <nav className="mt-4 flex flex-wrap items-center gap-3" aria-label={paginationLabel}>
      {summary && <p className="text-[length:var(--text-sm)] text-muted">{summary}</p>}
      <div className="flex items-center gap-1" aria-label={paginationLabel}>
        {isFirst ? (
          <span
            aria-disabled="true"
            aria-label={previousLabel}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] text-muted/45"
          >
            ‹
          </span>
        ) : (
          <Link
            href={hrefForPage(currentPage - 1)}
            aria-label={previousLabel}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] text-muted hover:bg-surface-sunken hover:text-foreground"
          >
            ‹
          </Link>
        )}
        {pageItems.map((item, index) =>
          item === null ? (
            <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">…</span>
          ) : (
            <Link
              key={item}
              href={hrefForPage(item)}
              aria-current={item === currentPage ? "page" : undefined}
              aria-label={pageLabel(item)}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] px-2 text-[length:var(--text-sm)] font-semibold ${
                item === currentPage
                  ? "bg-brand text-brand-contrast"
                  : "text-muted hover:bg-surface-sunken hover:text-foreground"
              }`}
            >
              {item}
            </Link>
          )
        )}
        {isLast ? (
          <span
            aria-disabled="true"
            aria-label={nextLabel}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] text-muted/45"
          >
            ›
          </span>
        ) : (
          <Link
            href={hrefForPage(currentPage + 1)}
            aria-label={nextLabel}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] text-muted hover:bg-surface-sunken hover:text-foreground"
          >
            ›
          </Link>
        )}
      </div>
    </nav>
  );
}

function pageWindow(currentPage: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const items: (number | null)[] = [];
  for (const page of sorted) {
    if (items.length && page - (items[items.length - 1] as number) > 1) items.push(null);
    items.push(page);
  }
  return items;
}
