"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { controlClass } from "@/components/ui";

/**
 * Role changer for one staff account.
 *
 * The caller supplies only the roles the actor may actually assign to this
 * target — an admin never receives "Superadmin" as an option. That is a
 * usability measure: `PATCH /api/admin/users/[id]` re-derives the actor's role
 * from the session and re-applies the same rules, so submitting a role that is
 * not offered here is refused with 409 rather than silently applied.
 *
 * Applies on change with a confirmation, because a role change takes effect on
 * the target's next request and is not obviously reversible by them.
 */
const DENY_TEXT: Record<string, string> = {
  forbidden: "Your role cannot do that.",
  cannotModifySelf: "You cannot change your own role.",
  cannotModifySuperadmin: "Only a superadmin can modify a superadmin account.",
  cannotAssignSuperadmin: "Only a superadmin can assign the superadmin role.",
  lastSuperadmin: "This is the last active superadmin.",
};

export function RoleSelect({
  userId,
  currentRole,
  options,
}: {
  userId: number;
  currentRole: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(nextRole: string) {
    if (nextRole === currentRole) return;
    if (
      !window.confirm(
        `Change this account's role to ${nextRole}? It applies on their next request.`
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(
          (data.error && DENY_TEXT[data.error]) ?? "That change could not be saved."
        );
        return;
      }
      router.refresh();
    } catch {
      setError("That change could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role
      </label>
      <select
        id={`role-${userId}`}
        defaultValue={currentRole}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className={`${controlClass} h-9 w-auto py-0 text-[length:var(--text-xs)]`}
      >
        <option value={currentRole}>{currentRole}</option>
        {options
          .filter((option) => option.value !== currentRole)
          .map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
      {error && (
        <span role="alert" className="text-[length:var(--text-xs)] font-semibold text-danger-text">
          {error}
        </span>
      )}
    </span>
  );
}
