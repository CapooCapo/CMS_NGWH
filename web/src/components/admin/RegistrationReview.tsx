"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * BR-001 approve / reject controls.
 *
 * Approving publishes a club profile, so it asks for confirmation first. A
 * review is decision-only: no note is collected or sent. On success the router
 * is refreshed rather than the row being patched client-side, so the list
 * always reflects what the database actually recorded.
 */
export function RegistrationReview({
  id,
  status,
}: {
  id: number;
  status: "pending" | "approved" | "rejected";
}) {
  const router = useRouter();
  const t = useTranslations("admin.registrations");
  const actionsT = useTranslations("admin.actions");
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Review decisions are terminal. Keeping controls off terminal rows avoids
  // inviting an action the API rightly rejects; retries remain available to
  // API clients as idempotent calls.
  if (status !== "pending") return null;

  async function review(action: "approved" | "rejected") {
    if (
      action === "approved" &&
      !window.confirm(
        t("reviewConfirm")
      )
    ) {
      return;
    }
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/registrations/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        setError(
          response.status === 403
            ? t("reviewForbidden")
            : t("reviewFailed")
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(t("reviewFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p role="alert" className="text-[length:var(--text-xs)] font-semibold text-danger-text">
          {error}
        </p>
      )}
      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}>{actionsT("review")}</Button>
      ) : (
        <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-border bg-surface-sunken/70 p-4 shadow-[var(--shadow-xs)]">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => review("approved")}
              disabled={pending !== null}
              loading={pending === "approved"}
              loadingLabel={actionsT("approving")}
            >
              {actionsT("approve")}
            </Button>
            <Button
              tone="danger"
              size="sm"
              onClick={() => review("rejected")}
              disabled={pending !== null}
              loading={pending === "rejected"}
              loadingLabel={actionsT("rejecting")}
            >
              {actionsT("reject")}
            </Button>
            <Button tone="ghost" size="sm" onClick={() => setOpen(false)}>
              {actionsT("cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
