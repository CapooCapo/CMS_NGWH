import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { RegistrationBulkManager } from "@/components/admin/RegistrationBulkManager";
import { Button, EmptyState, ErrorState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { filterHref, parsePage } from "@/lib/pagination";
import {
  listRegistrationDocuments,
  listAdminRegistrations,
} from "@/server/repositories/registrations";
import type { RegistrationStatus } from "@/server/repositories/types";

export async function generateMetadata(): Promise<Metadata> {
  const [metaT, t] = await Promise.all([
    getTranslations("admin.meta"),
    getTranslations("admin.registrations"),
  ]);
  return {
    title: metaT("registrations"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

const STATUSES: readonly RegistrationStatus[] = ["pending", "approved", "rejected"];
/** REQ-REG-001 review queue, with the BR-001 approval action. */
export default async function AdminRegistrationsPage({
  searchParams,
}: PageProps<"/admin/registrations">) {
  const [t, statusT, actionsT, locale] = await Promise.all([
    getTranslations("admin.registrations"),
    getTranslations("admin.status"),
    getTranslations("admin.actions"),
    getLocale(),
  ]);
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = STATUSES.includes(raw as RegistrationStatus)
    ? (raw as RegistrationStatus)
    : null;
  const rawSearch = Array.isArray(params.q) ? params.q[0] : params.q;
  const search = rawSearch?.trim() || null;
  const page = parsePage(params.page);

  let rows;
  try {
    rows = await listAdminRegistrations(status, page, search);
  } catch (error) {
    console.error("admin registrations", error);
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState title={t("databaseUnavailable")} />
      </>
    );
  }

  // Document lists are small; fetch them per row for the download links.
  const documents = await Promise.all(
    rows.rows.map((row) =>
      listRegistrationDocuments(row.id).catch(() => [])
    )
  );

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
      />

      <nav aria-label={t("filterByStatus")} className="mb-5">
        <ul className="flex flex-wrap gap-2">
          {[
            { value: null, label: actionsT("all") },
            ...STATUSES.map((value) => ({ value, label: statusT(value) })),
          ].map((item) => {
              const active = item.value === status;
              return (
                <li key={item.value ?? "all"}>
                  <Link
                    href={filterHref("/admin/registrations", { status: item.value ?? undefined, q: search ?? undefined })}
                    aria-current={active ? "true" : undefined}
                    className={`inline-flex h-8 items-center rounded-[var(--radius-pill)] border px-3 text-[length:var(--text-xs)] font-semibold capitalize transition-colors duration-[var(--motion-fast)] ${
                      active
                        ? "border-brand bg-brand text-brand-contrast"
                        : "border-border-strong text-muted hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            }
          )}
        </ul>
      </nav>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="min-w-[min(100%,20rem)] flex-1">
          <label htmlFor="registration-search" className="mb-1 block text-[length:var(--text-sm)] font-semibold">
            {t("search")}
          </label>
          <input
            id="registration-search"
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder={t("searchPlaceholder")}
            maxLength={160}
            className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[length:var(--text-sm)] outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <Button type="submit" size="sm">{t("search")}</Button>
        {search && <Link href={filterHref("/admin/registrations", { status: status ?? undefined })} className="inline-flex h-8 items-center px-2 text-[length:var(--text-sm)] font-semibold text-muted hover:text-foreground hover:underline">{t("clearSearch")}</Link>}
      </form>

      {rows.rows.length === 0 ? (
        <EmptyState title={search ? t("emptySearch") : t("empty")} />
      ) : (
        <>
          <RegistrationBulkManager
            key={`${status ?? "all"}-${search ?? ""}-${rows.page}`}
            rows={rows.rows.map((row) => ({
              ...row,
              submitted_at: formatDateTime(row.created_at, locale) ?? "—",
            }))}
            documents={documents}
          />
          <AdminPagination basePath="/admin/registrations" pagination={rows} searchParams={{ status: status ?? undefined, q: search ?? undefined }} />
        </>
      )}
    </>
  );
}
