"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormAlert, controlClass } from "@/components/ui";

/**
 * Explicit confirmation for the destructive club action. The API repeats the
 * exact confirmation check; the server currently refuses the final deletion
 * because no data-retention policy has been approved for club records.
 */
export function ClubDeletionControl({
  clubId,
  requested,
  labels,
}: {
  clubId: number;
  requested: boolean;
  labels: {
    open: string;
    title: string;
    body: string;
    confirmationPrompt: string;
    cancel: string;
    confirm: string;
    unavailable: string;
    failed: string;
    requested: string;
    cancelRequest: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  function close() {
    if (pending) return;
    setOpen(false);
    setConfirmation("");
    setError(null);
  }

  async function removeClub() {
    if (confirmation !== "DELETE") return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/owner/clubs/${clubId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (response.ok) {
        close();
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error === "deletionNotAllowed" ? labels.unavailable : labels.failed);
    } catch {
      setError(labels.failed);
    } finally {
      setPending(false);
    }
  }

  async function cancelRequest() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/owner/clubs/${clubId}/deletion-request`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("cancel failed");
      router.refresh();
    } catch {
      setError(labels.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {requested ? (
        <span className="flex items-center gap-2">
          <span className="text-[length:var(--text-sm)] font-semibold text-warning-text">{labels.requested}</span>
          <Button type="button" tone="outline" onClick={cancelRequest} loading={pending}>
            {labels.cancelRequest}
          </Button>
        </span>
      ) : (
        <Button type="button" tone="danger" onClick={() => setOpen(true)}>
          {labels.open}
        </Button>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${inputId}-title`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-[var(--shadow-lg)] sm:p-7">
            <h2 id={`${inputId}-title`} className="text-[length:var(--text-xl)] font-extrabold">
              {labels.title}
            </h2>
            <p className="mt-3 text-[length:var(--text-sm)] leading-relaxed text-muted">{labels.body}</p>
            {error && (
              <div className="mt-5">
                <FormAlert title={error} />
              </div>
            )}
            <div className="mt-5">
              <Field id={inputId} label={labels.confirmationPrompt}>
                {(field) => (
                  <input
                    {...field}
                    autoFocus
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.currentTarget.value)}
                    className={controlClass}
                    spellCheck={false}
                    autoComplete="off"
                  />
                )}
              </Field>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" tone="outline" onClick={close} disabled={pending}>
                {labels.cancel}
              </Button>
              <Button
                type="button"
                tone="danger"
                onClick={removeClub}
                disabled={confirmation !== "DELETE"}
                loading={pending}
              >
                {labels.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
