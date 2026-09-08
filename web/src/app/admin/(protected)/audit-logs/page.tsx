import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { isPrivileged } from "@/server/auth/permissions";
import { currentAdmin } from "@/server/auth/session";
import { listAdminAuditLogs, type AdminAuditLog } from "@/server/repositories/adminAuditLogs";

export async function generateMetadata(): Promise<Metadata> {
  const [metaT, t] = await Promise.all([
    getTranslations("admin.meta"),
    getTranslations("admin.auditLogs"),
  ]);
  return {
    title: metaT("auditLogs"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

function metadataSummary(metadata: AdminAuditLog["metadata"], empty: string): string {
  const text = JSON.stringify(metadata);
  return text === "{}" ? empty : text.length > 240 ? `${text.slice(0, 239)}…` : text;
}

/** Privileged, server-rendered, read-only history of administrative changes. */
export default async function AdminAuditLogsPage({
  searchParams,
}: PageProps<"/admin/audit-logs">) {
  const [t, locale, admin] = await Promise.all([
    getTranslations("admin.auditLogs"),
    getLocale(),
    currentAdmin(),
  ]);
  if (!admin) redirect("/admin/login");
  if (!isPrivileged(admin.role)) redirect("/admin/dashboard");

  const page = parsePage((await searchParams).page);
  let logs;
  try {
    logs = await listAdminAuditLogs(page);
  } catch (error) {
    console.error("admin audit logs", error);
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState title={t("databaseUnavailable")} />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title={t("title")} description={t("description")} />
      {logs.rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <>
          <Table
            caption={t("tableCaption")}
            minWidth="76rem"
            head={<><Th sticky>{t("time")}</Th><Th>{t("actor")}</Th><Th>{t("action")}</Th><Th>{t("resource")}</Th><Th>{t("resourceId")}</Th><Th>{t("ip")}</Th><Th>{t("metadata")}</Th></>}
          >
            {logs.rows.map((log) => (
              <tr key={log.id} className="hover:bg-surface-sunken">
                <Td header sticky className="whitespace-nowrap text-muted">
                  {formatDateTime(log.createdAt, locale) ?? "—"}
                </Td>
                <Td>{log.actorUsername}</Td>
                <Td><code className="text-[length:var(--text-xs)]">{log.action}</code></Td>
                <Td>{log.resourceType}</Td>
                <Td className="tabular">{log.resourceId}</Td>
                <Td className="whitespace-nowrap text-muted">{log.clientIp ?? t("unknownIp")}</Td>
                <Td className="max-w-80"><code className="block truncate text-[length:var(--text-xs)]" title={metadataSummary(log.metadata, t("noMetadata"))}>{metadataSummary(log.metadata, t("noMetadata"))}</code></Td>
              </tr>
            ))}
          </Table>
          <AdminPagination basePath="/admin/audit-logs" pagination={logs} searchParams={{}} />
        </>
      )}
    </>
  );
}
