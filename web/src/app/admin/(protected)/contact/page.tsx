import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { filterHref, parsePage } from "@/lib/pagination";
import { listAdminContactMessages } from "@/server/repositories/contact";
import type { ContactStatus } from "@/server/repositories/types";

export async function generateMetadata(): Promise<Metadata> {
  const [metaT, t] = await Promise.all([
    getTranslations("admin.meta"),
    getTranslations("admin.contact"),
  ]);
  return {
    title: metaT("contact"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

const STATUSES: readonly ContactStatus[] = ["new", "read", "archived"];
const TONE = { new: "warning", read: "neutral", archived: "muted" } as const;

/**
 * REQ-CONTACT-002 inbox.
 *
 * This is where submissions terminate: OQ-014 has not decided where messages
 * should be routed, so nothing is forwarded by email and the inbox is the
 * system of record.
 */
export default async function AdminContactPage({
  searchParams,
}: PageProps<"/admin/contact">) {
  const [t, statusT, actionsT, locale] = await Promise.all([
    getTranslations("admin.contact"),
    getTranslations("admin.status"),
    getTranslations("admin.actions"),
    getLocale(),
  ]);
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = STATUSES.includes(raw as ContactStatus)
    ? (raw as ContactStatus)
    : null;
  const page = parsePage(params.page);
  const rawMessage = Array.isArray(params.message) ? params.message[0] : params.message;
  const selectedMessageId = rawMessage ? Number.parseInt(rawMessage, 10) : null;

  let messages;
  try {
    messages = await listAdminContactMessages(status, page);
  } catch (error) {
    console.error("admin contact", error);
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState title={t("databaseUnavailable")} />
      </>
    );
  }

  const hrefForMessage = (id: number) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (messages.page > 1) query.set("page", String(messages.page));
    if (selectedMessageId !== id) query.set("message", String(id));
    const suffix = query.toString();
    return `/admin/contact${suffix ? `?${suffix}` : ""}`;
  };

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
          ].map((item) => (
              <li key={item.value ?? "all"}>
                <Link
                    href={filterHref("/admin/contact", { status: item.value ?? undefined })}
                  aria-current={item.value === status ? "true" : undefined}
                  className={`inline-flex h-8 items-center rounded-[var(--radius-pill)] border px-3 text-[length:var(--text-xs)] font-semibold capitalize transition-colors duration-[var(--motion-fast)] ${
                    item.value === status
                      ? "border-brand bg-brand text-brand-contrast"
                      : "border-border-strong text-muted hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          )}
        </ul>
      </nav>

      {messages.rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <>
          <Table
            caption={t("tableCaption")}
            minWidth="52rem"
            head={
              <>
                <Th sticky>{t("sender")}</Th>
                <Th>{t("subject")}</Th>
                <Th>{t("received")}</Th>
                <Th>{t("status")}</Th>
                <Th align="right">{t("actions")}</Th>
              </>
            }
          >
            {messages.rows.map((message) => {
              const isSelected = selectedMessageId === message.id;
              return (
                <Fragment key={message.id}>
                  <tr key={message.id} className={isSelected ? "bg-accent/10" : "hover:bg-surface-sunken"}>
                    <Td header sticky>
                      <span className="block font-semibold">{message.name}</span>
                      <a href={`mailto:${message.email}`} className="text-[length:var(--text-xs)] font-normal text-muted hover:underline">
                        {message.email}
                      </a>
                    </Td>
                    <Td>
                      <span className="font-medium">{message.subject || t("noSubject")}</span>
                      <span className="ml-2 text-[length:var(--text-xs)] text-muted">{message.locale.toUpperCase()}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(message.created_at, locale) ?? "—"}</Td>
                    <Td><Badge tone={TONE[message.status]}>{statusT(message.status)}</Badge></Td>
                    <Td align="right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={hrefForMessage(message.id)} aria-expanded={isSelected} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">
                          {isSelected ? t("closeDetails") : t("details")}
                        </Link>
                        {message.status !== "read" && (
                          <ToggleButton action={`/api/admin/contact/${message.id}`} method="PATCH" body={{ status: "read" }} label={actionsT("markRead")} />
                        )}
                        {message.status !== "archived" && (
                          <ToggleButton action={`/api/admin/contact/${message.id}`} method="PATCH" body={{ status: "archived" }} label={actionsT("archive")} tone="ghost" />
                        )}
                      </div>
                    </Td>
                  </tr>
                  {isSelected && (
                    <tr key={`${message.id}-detail`} className="bg-surface-sunken/45">
                      <Td colSpan={5}>
                        <p className="whitespace-pre-line rounded-[var(--radius-sm)] border border-border bg-surface p-3 text-[length:var(--text-sm)] leading-relaxed">
                          {message.message}
                        </p>
                      </Td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
          <AdminPagination basePath="/admin/contact" pagination={messages} searchParams={{ status: status ?? undefined }} />
        </>
      )}
    </>
  );
}
