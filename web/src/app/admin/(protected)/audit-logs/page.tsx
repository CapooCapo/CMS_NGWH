import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { formatAuditMetadata } from "@/lib/auditMetadata";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { isPrivileged } from "@/server/auth/permissions";
import { currentAdmin } from "@/server/auth/session";
import {
  listAdminAuditLogs,
  type AdminAuditLog,
} from "@/server/repositories/adminAuditLogs";
import type { PageSearchParams } from "@/app/page-props";

type PageProps = {
  searchParams: PageSearchParams;
};

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

/** Privileged, server-rendered, read-only history of administrative changes. */
export default async function AdminAuditLogsPage({
  searchParams,
}: PageProps) {
  const [t, locale, admin] = await Promise.all([
    getTranslations("admin.auditLogs"),
    getLocale(),
    currentAdmin(),
  ]);
  if (!admin) redirect("/admin/login");
  if (!isPrivileged(admin.role)) redirect("/admin/dashboard");

  const page = parsePage((await searchParams).page);
  const metadataLabels = {
    score: t("score"),
    homeFouls: t("homeFouls"),
    awayFouls: t("awayFouls"),
    status: t("status"),
  };
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
              <AuditLogRow
                key={log.id}
                log={log}
                locale={locale}
                unknownIp={t("unknownIp")}
                noMetadata={t("noMetadata")}
                metadataLabels={metadataLabels}
              />
            ))}
          </Table>
          <AdminPagination basePath="/admin/audit-logs" pagination={logs} searchParams={{}} />
        </>
      )}
    </>
  );
}

function AuditLogRow({
  log,
  locale,
  unknownIp,
  noMetadata,
  metadataLabels,
}: {
  log: AdminAuditLog;
  locale: string;
  unknownIp: string;
  noMetadata: string;
  metadataLabels: Parameters<typeof formatAuditMetadata>[2];
}) {
  const metadata = formatAuditMetadata(log.metadata, noMetadata, metadataLabels);
  return (
    <tr className="hover:bg-surface-sunken">
      <Td header sticky className="whitespace-nowrap text-muted">
        {formatDateTime(log.createdAt, locale) ?? "—"}
      </Td>
      <Td>{log.actorUsername}</Td>
      <Td><code className="text-[length:var(--text-xs)]">{log.action}</code></Td>
      <Td>{log.resourceType}</Td>
      <Td className="tabular">{log.resourceId}</Td>
      <Td className="whitespace-nowrap text-muted">{log.clientIp ?? unknownIp}</Td>
      <Td className="max-w-80">
        <code className="block truncate text-[length:var(--text-xs)]" title={metadata}>
          {metadata}
        </code>
      </Td>
    </tr>
  );
}
