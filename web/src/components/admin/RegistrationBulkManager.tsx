"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fragment, useMemo, useState } from "react";
import { RegistrationReview } from "@/components/admin/RegistrationReview";
import { Badge, Button, Table, Td, Th } from "@/components/ui";

type RegistrationStatus = "pending" | "approved" | "rejected";

export type RegistrationBulkRow = {
  id: number;
  club_name: string;
  operating_region: string;
  representative_name: string;
  representative_email: string;
  representative_phone: string | null;
  notes: string | null;
  status: RegistrationStatus;
  submitted_at: string;
  club_id: number | null;
};

export type RegistrationDocument = {
  id: number;
  filename: string;
  byte_size: number;
};

const TONE = { pending: "warning", approved: "success", rejected: "muted" } as const;

export function RegistrationBulkManager({
  rows,
  documents,
}: {
  rows: readonly RegistrationBulkRow[];
  documents: readonly (readonly RegistrationDocument[])[];
}) {
  const router = useRouter();
  const t = useTranslations("admin.registrations");
  const statusT = useTranslations("admin.status");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const canApprove = selectedRows.some((row) => row.status !== "rejected");
  const canReject = selectedRows.some((row) => row.status !== "approved");
  const deleteEligible = selectedRows.filter((row) => row.status !== "approved").length;
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));

  function failureReason(reason: string): string {
    switch (reason) {
      case "notFound":
        return t("bulkReasonNotFound");
      case "invalidReviewTransition":
        return t("bulkReasonInvalidReviewTransition");
      case "ownershipConflict":
        return t("bulkReasonOwnershipConflict");
      case "registrantUnavailable":
        return t("bulkReasonRegistrantUnavailable");
      case "deletionNotAllowed":
        return t("bulkReasonDeletionNotAllowed");
      default:
        return t("bulkFailed");
    }
  }

  async function perform(action: "approve" | "reject" | "delete") {
    if (selected.size === 0) return;
    let confirmation: string | undefined;
    if (action === "delete") {
      const protectedCount = selectedRows.length - deleteEligible;
      confirmation = window.prompt(
        [
          t("deletePrompt", { eligible: deleteEligible }),
          ...(protectedCount
            ? [t("deleteProtected", { protected: protectedCount })]
            : []),
          t("deleteConfirmInstruction"),
        ].join(" ")
      ) ?? undefined;
      if (confirmation !== "DELETE") return;
    }

    setPendingAction(action);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/registrations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action, confirmation }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        succeeded?: number[];
        failed?: { id: number; reason: string }[];
        fields?: Record<string, string>;
      };
      if (!response.ok) {
        setMessage(data.fields ? t("bulkUnavailable") : t("bulkFailed"));
        return;
      }
      const succeeded = data.succeeded?.length ?? 0;
      const failed = data.failed ?? [];
      setMessage(
        failed.length
          ? t("bulkPartial", {
              succeeded,
              failed: failed
                .map((item) =>
                  t("bulkFailureItem", { id: item.id, reason: failureReason(item.reason) })
                )
                .join(", "),
            })
          : t("bulkCompleted", { count: succeeded })
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      setMessage(t("bulkFailed"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-sunken/60 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={allSelected} onChange={selectAll} aria-label={t("selectAll")} />
          {t("selectAll")}
        </label>
        <span className="text-sm text-muted">{t("selected", { count: selected.size })}</span>
        <Button size="sm" onClick={() => perform("approve")} disabled={!canApprove || pendingAction !== null} loading={pendingAction === "approve"}>
          {t("approveSelected")}
        </Button>
        <Button size="sm" tone="outline" onClick={() => perform("reject")} disabled={!canReject || pendingAction !== null} loading={pendingAction === "reject"}>
          {t("rejectSelected")}
        </Button>
        <Button size="sm" tone="danger" onClick={() => perform("delete")} disabled={selected.size === 0 || pendingAction !== null} loading={pendingAction === "delete"}>
          {t("deleteSelected", { eligible: deleteEligible })}
        </Button>
        {message && <p role="status" className="basis-full text-sm text-muted">{message}</p>}
      </div>

      <Table
        caption={t("tableCaption")}
        minWidth="58rem"
        head={<><Th><input type="checkbox" checked={allSelected} onChange={selectAll} aria-label={t("selectAll")} /></Th><Th sticky>{t("club")}</Th><Th>{t("region")}</Th><Th>{t("representative")}</Th><Th>{t("submitted")}</Th><Th>{t("status")}</Th><Th align="right">{t("actions")}</Th></>}
      >
        {rows.map((row, index) => {
          const expanded = expandedId === row.id;
          return (
            <Fragment key={row.id}>
              <tr className={expanded ? "bg-accent/10" : "hover:bg-surface-sunken"}>
                <Td><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={t("select", { club: row.club_name })} /></Td>
                <Td header sticky><span className="block">{row.club_name}</span><span className="block text-[length:var(--text-xs)] font-normal text-muted">#{row.id}</span></Td>
                <Td>{row.operating_region}</Td>
                <Td><span className="block">{row.representative_name}</span><a href={`mailto:${row.representative_email}`} className="text-[length:var(--text-xs)] text-muted hover:underline">{row.representative_email}</a></Td>
                <Td className="whitespace-nowrap text-muted">{row.submitted_at}</Td>
                <Td><Badge tone={TONE[row.status]}>{statusT(row.status)}</Badge></Td>
                <Td align="right"><div className="flex flex-wrap justify-end gap-2"><Button size="sm" tone="ghost" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : row.id)}>{expanded ? t("closeDetails") : t("details")}</Button><RegistrationReview id={row.id} status={row.status} /></div></Td>
              </tr>
              {expanded && (
                <tr className="bg-surface-sunken/45"><Td colSpan={7}>
                  <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
                    <div className="flex gap-2"><dt className="text-muted">{t("phone")}:</dt><dd>{row.representative_phone ?? "—"}</dd></div>
                    <div className="flex gap-2"><dt className="text-muted">{t("email")}:</dt><dd><a href={`mailto:${row.representative_email}`} className="hover:underline">{row.representative_email}</a></dd></div>
                    {row.club_id && <div className="flex gap-2"><dt className="text-muted">{t("club")}:</dt><dd><Link href={`/admin/clubs?highlight=${row.club_id}`} className="hover:underline">#{row.club_id}</Link></dd></div>}
                  </dl>
                  {row.notes && <p className="mt-3 whitespace-pre-line rounded-[var(--radius-md)] border border-border/80 bg-surface p-3.5 text-[length:var(--text-sm)] leading-relaxed">{row.notes}</p>}
                  {documents[index]?.length > 0 && <div className="mt-4"><h3 className="eyebrow text-muted">{t("attachments", { count: documents[index].length })}</h3><ul className="mt-1.5 flex flex-col gap-2">{documents[index].map((doc) => <li key={doc.id} className="flex flex-wrap items-center gap-2"><a href={`/api/admin/registrations/${row.id}/documents/${doc.id}`} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{doc.filename}</a><span className="tabular text-[length:var(--text-xs)] text-muted">{t("fileSizeKb", { size: (doc.byte_size / 1024).toFixed(0) })}</span></li>)}</ul></div>}
                </Td></tr>
              )}
            </Fragment>
          );
        })}
      </Table>
    </>
  );
}
