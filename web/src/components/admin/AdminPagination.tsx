import { getTranslations } from "next-intl/server";
import { PaginationControl } from "@/components/PaginationControl";
import type { Pagination } from "@/lib/pagination";

/** Localized paginator shared by server-rendered admin record lists. */
export async function AdminPagination({
  basePath,
  pagination,
  searchParams,
}: {
  basePath: string;
  pagination: Pagination;
  searchParams: Record<string, string | undefined>;
}) {
  const t = await getTranslations("admin.pagination");
  return (
    <PaginationControl
      basePath={basePath}
      paramName="page"
      currentPage={pagination.page}
      totalPages={pagination.totalPages}
      searchParams={searchParams}
      paginationLabel={t("label")}
      previousLabel={t("previous")}
      nextLabel={t("next")}
      pageLabel={(page) => t("page", { page, total: pagination.totalPages })}
      summary={t("showing", {
        from: pagination.firstItem,
        to: pagination.lastItem,
        total: pagination.total,
      })}
    />
  );
}
