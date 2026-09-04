"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, type ButtonTone } from "@/components/ui";

/**
 * Small POST/PATCH/DELETE button used for one-field state changes
 * (publish a club, archive a message, deactivate an account, delete a row).
 *
 * `confirm` is required for destructive actions so a stray click cannot
 * unpublish a club or delete a fixture.
 */
export function ToggleButton({
  action,
  method = "POST",
  body,
  label,
  pendingLabel = "…",
  tone = "outline",
  confirm,
}: {
  action: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  label: string;
  pendingLabel?: string;
  tone?: ButtonTone;
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        tone={tone}
        size="sm"
        loading={pending}
        loadingLabel={pendingLabel}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setPending(true);
          setError(null);
          try {
            const response = await fetch(action, {
              method,
              headers: body ? { "Content-Type": "application/json" } : undefined,
              body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
              const data = (await response.json().catch(() => ({}))) as {
                error?: string;
              };
              setError(
                data.error === "forbidden"
                  ? "Not permitted for your role."
                  : data.error === "cannotModifySelf"
                    ? "You cannot change your own account."
                    : "That change could not be saved."
              );
              return;
            }
            router.refresh();
          } catch {
            setError("That change could not be saved.");
          } finally {
            setPending(false);
          }
        }}
      >
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-[length:var(--text-xs)] font-semibold text-danger-text">
          {error}
        </span>
      )}
    </span>
  );
}
