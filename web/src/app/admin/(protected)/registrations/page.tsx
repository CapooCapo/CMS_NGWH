import Link from "next/link";
import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { RegistrationBulkManager } from "@/components/admin/RegistrationBulkManager";
import { EmptyState, ErrorState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import {
  listRegistrationDocuments,
  listRegistrations,
} from "@/server/repositories/registrations";
import type { RegistrationStatus } from "@/server/repositories/types";

export const metadata: Metadata = {
  title: "Registrations",
  robots: { index: false, follow: false },
};

const STATUSES: readonly RegistrationStatus[] = ["pending", "approved", "rejected"];
/** REQ-REG-001 review queue, with the BR-001 approval action. */
export default async function AdminRegistrationsPage({
  searchParams,
}: PageProps<"/admin/registrations">) {
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = STATUSES.includes(raw as RegistrationStatus)
    ? (raw as RegistrationStatus)
    : null;

  let rows;
  try {
    rows = await listRegistrations(status);
  } catch (error) {
    console.error("admin registrations", error);
    return (
      <>
        <AdminPageHeader title="Registrations" />
        <ErrorState title="Database unavailable" />
      </>
    );
  }

  // Document lists are small; fetch them per row for the download links.
  const documents = await Promise.all(
    rows.map((row) =>
      listRegistrationDocuments(row.id).catch(() => [])
    )
  );

  return (
    <>
      <AdminPageHeader
        title="Registrations"
        description="Approving a registration publishes the club profile (BR-001)."
      />

      <nav aria-label="Filter by status" className="mb-5">
        <ul className="flex flex-wrap gap-2">
          {[{ value: null, label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s }))].map(
            (item) => {
              const active = item.value === status;
              return (
                <li key={item.value ?? "all"}>
                  <Link
                    href={
                      item.value
                        ? `/admin/registrations?status=${item.value}`
                        : "/admin/registrations"
                    }
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

      {rows.length === 0 ? (
        <EmptyState title="No registrations to show." />
      ) : (
        <RegistrationBulkManager
          rows={rows.map((row) => ({
            ...row,
            submitted_at: formatDateTime(row.created_at, "en") ?? "—",
          }))}
          documents={documents}
        />
      )}
    </>
  );
}
