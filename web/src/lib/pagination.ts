/**
 * Shared, presentation-neutral paging helpers. Admin list repositories use
 * these values so a request can never turn into an unbounded list query.
 */
export const ADMIN_PAGE_SIZE = 10;

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  offset: number;
  firstItem: number;
  lastItem: number;
};

export type PaginatedResult<T> = Pagination & {
  rows: T[];
};

export function parsePage(
  value: string | string[] | undefined | null
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Resolves page ranges after the repository has counted matching records.
 * Empty lists deliberately retain page one, which keeps their URL stable.
 */
export function resolvePagination(
  requestedPage: number,
  total: number,
  pageSize = ADMIN_PAGE_SIZE
): Pagination {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * safePageSize;
  const firstItem = total === 0 ? 0 : offset + 1;
  const lastItem = Math.min(offset + safePageSize, total);

  return {
    page,
    pageSize: safePageSize,
    total,
    totalPages,
    offset,
    firstItem,
    lastItem,
  };
}

/** Builds a page link while retaining filters and replacing only the page key. */
export function pageHref(
  basePath: string,
  paramName: string,
  page: number,
  searchParams: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== paramName) params.set(key, value);
  }
  params.set(paramName, String(page));
  return `${basePath}?${params.toString()}`;
}

/** Filter links deliberately remove pagination so a new filter begins at one. */
export function filterHref(
  basePath: string,
  searchParams: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
