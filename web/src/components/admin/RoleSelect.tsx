"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
export function RoleSelect({
  userId,
  currentRole,
  currentRoleLabel,
  options,
}: {
  userId: number;
  currentRole: string;
  currentRoleLabel?: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const t = useTranslations("admin.users");
  const formsT = useTranslations("admin.forms");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(nextRole: string) {
    if (nextRole === currentRole) return;
    const nextRoleLabel = options.find((option) => option.value === nextRole)?.label ?? nextRole;
    if (
      !window.confirm(
        t("changeRoleConfirm", { role: nextRoleLabel })
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
        const denyText: Record<string, string> = {
          forbidden: formsT("errorForbidden"),
          cannotModifySelf: t("cannotChangeOwnRole"),
          cannotModifySuperadmin: t("cannotModifySuperadmin"),
          cannotAssignSuperadmin: t("cannotAssignSuperadmin"),
          lastSuperadmin: t("lastSuperadmin"),
        };
        setError(
          (data.error && denyText[data.error]) ?? formsT("errorSave")
        );
        return;
      }
      router.refresh();
    } catch {
      setError(formsT("errorSave"));
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <label className="sr-only" htmlFor={`role-${userId}`}>
        {t("roleLabel")}
      </label>
      <select
        id={`role-${userId}`}
        defaultValue={currentRole}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className={`${controlClass} h-9 w-auto py-0 text-[length:var(--text-xs)]`}
      >
        <option value={currentRole}>{currentRoleLabel ?? currentRole}</option>
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
