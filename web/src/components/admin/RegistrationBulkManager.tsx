"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RegistrationReview } from "@/components/admin/RegistrationReview";
import { Badge, Button, Card } from "@/components/ui";

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
  const [selected, setSelected] = useState<Set<number>>(new Set());
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

  async function perform(action: "approve" | "reject" | "delete") {
    if (selected.size === 0) return;
    let confirmation: string | undefined;
    if (action === "delete") {
      const protectedCount = selectedRows.length - deleteEligible;
      confirmation = window.prompt(
        `Delete ${deleteEligible} eligible registration${deleteEligible === 1 ? "" : "s"} permanently?` +
          (protectedCount
            ? ` ${protectedCount} approved registration${protectedCount === 1 ? " is" : "s are"} protected and will be skipped.`
            : "") +
          " Type DELETE to confirm."
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
        setMessage(data.fields ? "The selected registrations could not be processed." : "The bulk action failed.");
        return;
      }
      const succeeded = data.succeeded?.length ?? 0;
      const failed = data.failed ?? [];
      setMessage(
        failed.length
          ? `${succeeded} completed. ${failed.map((item) => `#${item.id}: ${item.reason}`).join(", ")}`
          : `${succeeded} registration${succeeded === 1 ? "" : "s"} completed.`
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      setMessage("The bulk action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-sunken/60 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={allSelected} onChange={selectAll} aria-label="Select all registrations" />
          Select all
        </label>
        <span className="text-sm text-muted">Selected: {selected.size}</span>
        <Button size="sm" onClick={() => perform("approve")} disabled={!canApprove || pendingAction !== null} loading={pendingAction === "approve"}>
          Approve selected
        </Button>
        <Button size="sm" tone="outline" onClick={() => perform("reject")} disabled={!canReject || pendingAction !== null} loading={pendingAction === "reject"}>
          Reject selected
        </Button>
        <Button size="sm" tone="danger" onClick={() => perform("delete")} disabled={selected.size === 0 || pendingAction !== null} loading={pendingAction === "delete"}>
          Delete selected{selected.size ? ` (${deleteEligible} eligible)` : ""}
        </Button>
        {message && <p role="status" className="basis-full text-sm text-muted">{message}</p>}
      </div>

      <ul className="flex flex-col gap-4">
        {rows.map((row, i) => (
          <li key={row.id}>
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.club_name}`}
                    />
                    <h2 className="text-[length:var(--text-base)] font-bold">{row.club_name}</h2>
                    <Badge tone={TONE[row.status]}>{row.status}</Badge>
                    <span className="tabular text-[length:var(--text-xs)] text-muted">#{row.id}</span>
                  </div>
                  <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
                    <div className="flex gap-2"><dt className="text-muted">Region:</dt><dd>{row.operating_region}</dd></div>
                    <div className="flex gap-2"><dt className="text-muted">Representative:</dt><dd>{row.representative_name}</dd></div>
                    <div className="flex gap-2"><dt className="text-muted">Email:</dt><dd><a href={`mailto:${row.representative_email}`} className="hover:underline">{row.representative_email}</a></dd></div>
                    {row.representative_phone && <div className="flex gap-2"><dt className="text-muted">Phone:</dt><dd>{row.representative_phone}</dd></div>}
                    <div className="flex gap-2"><dt className="text-muted">Submitted:</dt><dd>{row.submitted_at}</dd></div>
                    {row.club_id && <div className="flex gap-2"><dt className="text-muted">Club:</dt><dd><Link href={`/admin/clubs?highlight=${row.club_id}`} className="hover:underline">#{row.club_id}</Link></dd></div>}
                  </dl>
                  {row.notes && <p className="mt-3 whitespace-pre-line rounded-[var(--radius-md)] border border-border/80 bg-surface-sunken/60 p-3.5 text-[length:var(--text-sm)] leading-relaxed">{row.notes}</p>}
                  {documents[i]?.length > 0 && (
                    <div className="mt-4"><h3 className="eyebrow text-muted">Attachments ({documents[i].length})</h3><ul className="mt-1.5 flex flex-col gap-2">{documents[i].map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center gap-2"><a href={`/api/admin/registrations/${row.id}/documents/${doc.id}`} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{doc.filename}</a><span className="tabular text-[length:var(--text-xs)] text-muted">{(doc.byte_size / 1024).toFixed(0)} KB</span></li>
                    ))}</ul></div>
                  )}
                </div>
                <RegistrationReview id={row.id} status={row.status} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
