import Link from "next/link";
import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, Card, EmptyState, ErrorState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { listContactMessages } from "@/server/repositories/contact";
import type { ContactStatus } from "@/server/repositories/types";

export const metadata: Metadata = {
  title: "Contact inbox",
  robots: { index: false, follow: false },
};

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
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = STATUSES.includes(raw as ContactStatus)
    ? (raw as ContactStatus)
    : null;

  let messages;
  try {
    messages = await listContactMessages(status);
  } catch (error) {
    console.error("admin contact", error);
    return (
      <>
        <AdminPageHeader title="Contact inbox" />
        <ErrorState title="Database unavailable" />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Contact inbox"
        description="Submissions are stored here; no automatic email routing is configured (OQ-014)."
      />

      <nav aria-label="Filter by status" className="mb-5">
        <ul className="flex flex-wrap gap-2">
          {[{ value: null, label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s }))].map(
            (item) => (
              <li key={item.value ?? "all"}>
                <Link
                  href={
                    item.value
                      ? `/admin/contact?status=${item.value}`
                      : "/admin/contact"
                  }
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

      {messages.length === 0 ? (
        <EmptyState title="No messages." />
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">
                        {message.subject || "(no subject)"}
                      </h2>
                      <Badge tone={TONE[message.status]}>{message.status}</Badge>
                      <Badge tone="muted">{message.locale.toUpperCase()}</Badge>
                    </div>
                    <p className="mt-1 text-[length:var(--text-sm)] text-muted">
                      {message.name} ·{" "}
                      <a href={`mailto:${message.email}`} className="hover:underline">
                        {message.email}
                      </a>{" "}
                      · {formatDateTime(message.created_at, "en")}
                    </p>
                    <p className="mt-3 whitespace-pre-line rounded-[var(--radius-sm)] border border-border bg-surface-sunken p-3 text-[length:var(--text-sm)] leading-relaxed">
                      {message.message}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {message.status !== "read" && (
                      <ToggleButton
                        action={`/api/admin/contact/${message.id}`}
                        method="PATCH"
                        body={{ status: "read" }}
                        label="Mark read"
                      />
                    )}
                    {message.status !== "archived" && (
                      <ToggleButton
                        action={`/api/admin/contact/${message.id}`}
                        method="PATCH"
                        body={{ status: "archived" }}
                        label="Archive"
                        tone="ghost"
                      />
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
