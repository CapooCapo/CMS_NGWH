import Link from "next/link";

type PaginationControlProps = {
  basePath: string;
  paramName: string;
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  previousLabel: string;
  nextLabel: string;
};

export function PaginationControl({
  basePath,
  paramName,
  currentPage,
  totalPages,
  searchParams,
  previousLabel,
  nextLabel,
}: PaginationControlProps) {
  if (totalPages <= 1) return null;

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== paramName) params.set(key, value);
    }
    params.set(paramName, String(page));
    return `${basePath}?${params.toString()}`;
  };

  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <nav className="flex items-center gap-2 mt-4" aria-label="Pagination">
      <Link
        href={hrefForPage(Math.max(1, currentPage - 1))}
        aria-label={previousLabel}
        aria-disabled={isFirst}
        className={
          isFirst
            ? "pointer-events-none opacity-30"
            : "hover:opacity-70"
        }
      >
        &lt;
      </Link>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Link
          key={page}
          href={hrefForPage(page)}
          aria-current={page === currentPage ? "page" : undefined}
          aria-label={`Page ${page}`}
          className={
            page === currentPage
              ? "text-lg"
              : "text-lg opacity-30 hover:opacity-70"
          }
        >
          o
        </Link>
      ))}
      <Link
        href={hrefForPage(Math.min(totalPages, currentPage + 1))}
        aria-label={nextLabel}
        aria-disabled={isLast}
        className={
          isLast
            ? "pointer-events-none opacity-30"
            : "hover:opacity-70"
        }
      >
        &gt;
      </Link>
    </nav>
  );
}
