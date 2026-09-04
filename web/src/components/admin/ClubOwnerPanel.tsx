"use client";

import { JsonForm } from "@/components/admin/JsonForm";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge } from "@/components/ui";
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
export function ClubOwnerPanel({
  clubId,
  owner,
}: {
  clubId: number;
  owner: ClubOwner | null;
}) {
  if (owner) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          Owner: <strong>{owner.email}</strong>
        </p>
        <Badge tone={owner.is_active ? "success" : "muted"}>
          {owner.is_active ? "Active" : "Deactivated"}
        </Badge>
        <ToggleButton
          action={`/api/admin/clubs/${clubId}/owner`}
          method="DELETE"
          label="Unassign owner"
          tone="dangerGhost"
          confirm="Unassign this club's owner? Their account will be deactivated and they will lose access immediately."
        />
      </div>
    );
  }

  return (
    <JsonForm
      action={`/api/admin/clubs/${clubId}/owner`}
      submitLabel="Create & assign owner"
      compact
      fields={[
        { name: "email", label: "Owner email", type: "email", required: true },
        {
          name: "password",
          label: "Temporary password",
          type: "password",
          required: true,
          hint: "At least 10 characters. Share this with the club representative directly — it is never shown again.",
        },
      ]}
    />
  );
}
