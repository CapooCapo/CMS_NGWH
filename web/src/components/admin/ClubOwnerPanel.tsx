import { JsonForm } from "@/components/admin/JsonForm";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge } from "@/components/ui";
import { getTranslations } from "next-intl/server";
import type { ClubOwner } from "@/server/repositories/clubOwners";

/**
 * "ASSIGN / CREATE CLUB OWNER" — the step that turns an approved club into
 * one a Club Owner can sign in and manage from `/my-club`.
 *
 * Deliberately admin-only (`requireRole()` on both API routes): assigning who
 * controls a club is the same class of decision as approving it. Creating the
 * account and linking it to this specific club happen in one transaction
 * server-side (`createAndAssignClubOwner`) — this form never gets to say
 * *which* club id the new account is for beyond the one the button is on.
 */
export async function ClubOwnerPanel({
  clubId,
  owner,
}: {
  clubId: number;
  owner: ClubOwner | null;
}) {
  const t = await getTranslations("admin.clubs.owner");

  if (owner) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          {t("owner")}: <strong>{owner.email}</strong>
        </p>
        <Badge tone={owner.is_active ? "success" : "muted"}>
          {owner.is_active ? t("active") : t("deactivated")}
        </Badge>
        <ToggleButton
          action={`/api/admin/clubs/${clubId}/owner`}
          method="DELETE"
          label={t("unassign")}
          tone="dangerGhost"
          confirm={t("unassignConfirm")}
        />
      </div>
    );
  }

  return (
    <JsonForm
      action={`/api/admin/clubs/${clubId}/owner`}
      submitLabel={t("create")}
      compact
      fields={[
        { name: "email", label: t("email"), type: "email", required: true },
        {
          name: "password",
          label: t("temporaryPassword"),
          type: "password",
          required: true,
          hint: t("temporaryPasswordHint"),
        },
      ]}
    />
  );
}
