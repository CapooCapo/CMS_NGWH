"use client";

import { Fragment, useState } from "react";
import { JsonForm } from "@/components/admin/JsonForm";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, Button, Table, Td, Th } from "@/components/ui";
import type { ClubMember, ClubMemberRole } from "@/server/repositories/types";
import {
  PLAYER_POSITIONS,
  STAFF_ROLES,
  type ClubMemberPosition,
} from "@/lib/clubMembers";

export type ClubMembersLabels = {
  caption: string;
  number: string;
  name: string;
  role: string;
  position: string;
  born: string;
  actions: string;
  edit: string;
  cancel: string;
  delete: string;
  /**
   * A plain string containing the literal token `{name}`, not a function:
   * this object is passed from a Server Component page into this `"use
   * client"` component, and a function prop cannot cross that boundary
   * (it is not serializable). `deleteConfirmFor()` below does the
   * substitution client-side.
   */
  deleteConfirmTemplate: string;
  saveChanges: string;
  fullName: string;
  roleLabels: Record<ClubMemberRole, string>;
  positionLabels: Record<ClubMemberPosition, string>;
  /** Marks the club owner's own coaching entry. */
  headCoach: string;
};

/** Defaults match the admin panel's existing (English) copy exactly. */
const DEFAULT_LABELS: ClubMembersLabels = {
  caption: "Roster and coaching staff",
  number: "No.",
  name: "Name",
  role: "Role",
  position: "Position",
  born: "Born",
  actions: "Actions",
  edit: "Edit",
  cancel: "Cancel",
  delete: "Delete",
  deleteConfirmTemplate: "Remove {name} from the roster?",
  saveChanges: "Save changes",
  fullName: "Full name",
  roleLabels: { player: "Player", coach: "Coach", staff: "Staff" },
  positionLabels: {
    PG: "Point guard (PG)",
    SG: "Shooting guard (SG)",
    SF: "Small forward (SF)",
    PF: "Power forward (PF)",
    C: "Center (C)",
    HEAD_COACH: "Head coach",
    ASSISTANT_COACH: "Assistant coach",
    TEAM_MANAGER: "Team manager",
    TEAM_DOCTOR: "Team doctor",
    PHYSIOTHERAPIST: "Physiotherapist",
    STATISTICIAN: "Statistician",
    INTERPRETER: "Interpreter",
  },
  headCoach: "Head coach",
};

const deleteConfirmFor = (labels: ClubMembersLabels, name: string) =>
  labels.deleteConfirmTemplate.replace("{name}", name);

const editablePositions = (member: ClubMember): readonly ClubMemberPosition[] => {
  if (member.is_head_coach) return [STAFF_ROLES[0]];
  // Editing can change the coarse `member_role`, so expose both controlled
  // domains and let the API validate the submitted code against that role.
  // This preserves existing role changes without restoring a free-text input.
  return [...PLAYER_POSITIONS, ...STAFF_ROLES.filter((role) => role !== "HEAD_COACH")];
};

const memberFields = (labels: ClubMembersLabels, member: ClubMember) =>
  [
    {
      name: "fullName",
      label: labels.fullName,
      required: true as const,
      defaultValue: member.full_name,
    },
    {
      name: "memberRole",
      label: labels.role,
      type: "select" as const,
      required: true as const,
      defaultValue: member.member_role,
      options: (["player", "coach", "staff"] as const).map((value) => ({
        value,
        label: labels.roleLabels[value],
      })),
    },
    { name: "shirtNumber", label: labels.number, type: "number" as const, min: 0, max: 99, defaultValue: member.shirt_number },
    {
      name: "position",
      label: labels.position,
      type: "select" as const,
      defaultValue: member.is_head_coach ? STAFF_ROLES[0] : member.position,
      options: editablePositions(member).map((value) => ({
        value,
        label: labels.positionLabels[value],
      })),
    },
    { name: "birthYear", label: labels.born, type: "number" as const, min: 1900, max: 2200, defaultValue: member.birth_year },
  ];

const positionLabel = (labels: ClubMembersLabels, position: string | null) =>
  position ? labels.positionLabels[position as ClubMemberPosition] ?? position : "—";

/**
 * REQ-CLUB-005 — roster and coaching staff, editable by whoever is authorized
 * to manage a specific club: admin/editor staff (`/admin/clubs`, hitting
 * `/api/admin/clubs/[id]/members/...`) or, since the Club Owner pass, the
 * owner themselves (`/my-club`, hitting `/api/owner/club/members/...`).
 *
 * The component itself carries no authorization logic at all — `actionBase`
 * says which endpoint family to call, and every one of those endpoints
 * re-derives who is allowed to do what server-side. This is what lets the
 * same table serve two completely separate security domains without
 * duplicating the UI.
 *
 * A real table (not cards) with per-row Edit (inline `JsonForm` PATCH) and
 * Delete (`ToggleButton` DELETE with a confirmation), plus an "Add member"
 * create form.
 */
export function ClubMembersTable({
  actionBase,
  members,
  emptyLabel,
  labels,
}: {
  /** e.g. `/api/admin/clubs/12/members` or `/api/owner/club/members`. */
  actionBase: string;
  members: readonly ClubMember[];
  emptyLabel: string;
  labels?: Partial<ClubMembersLabels>;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const l: ClubMembersLabels = { ...DEFAULT_LABELS, ...labels };

  if (members.length === 0) {
    return <p className="text-[length:var(--text-sm)] text-muted">{emptyLabel}</p>;
  }

  return (
    <Table
      caption={l.caption}
      minWidth="42rem"
      head={
        <>
          <Th align="right" className="w-14">{l.number}</Th>
          <Th sticky>{l.name}</Th>
          <Th>{l.role}</Th>
          <Th>{l.position}</Th>
          <Th align="right">{l.born}</Th>
          <Th align="right">{l.actions}</Th>
        </>
      }
    >
      {members.map((member) => (
        <Fragment key={member.id}>
          <tr>
            <Td align="right" numeric>{member.shirt_number ?? "—"}</Td>
            <Td header sticky strong>{member.full_name}</Td>
            <Td>
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <Badge tone={member.member_role === "player" ? "brand" : "neutral"}>
                  {l.roleLabels[member.member_role]}
                </Badge>
                {member.is_head_coach && <Badge tone="accent">{l.headCoach}</Badge>}
              </span>
            </Td>
            <Td>{positionLabel(l, member.position)}</Td>
            <Td align="right" numeric>{member.birth_year ?? "—"}</Td>
            <Td align="right">
              <div className="flex justify-end gap-2">
                <Button
                  tone="outline"
                  size="sm"
                  onClick={() => setEditing(editing === member.id ? null : member.id)}
                >
                  {editing === member.id ? l.cancel : l.edit}
                </Button>
                {/* The server refuses to delete the head-coach row (it is
                    the club owner's identity on the club), so no button is
                    offered for it — an action that always fails is worse
                    than an absent one. */}
                {!member.is_head_coach && (
                  <ToggleButton
                    action={`${actionBase}/${member.id}`}
                    method="DELETE"
                    label={l.delete}
                    tone="dangerGhost"
                    confirm={deleteConfirmFor(l, member.full_name)}
                  />
                )}
              </div>
            </Td>
          </tr>
          {editing === member.id && (
            <tr>
              <Td colSpan={6}>
                <div className="rounded-[var(--radius-md)] border border-border bg-surface-sunken/60 p-4 shadow-[var(--shadow-xs)]">
                  <JsonForm
                    action={`${actionBase}/${member.id}`}
                    method="PATCH"
                    submitLabel={l.saveChanges}
                    compact
                    fields={memberFields(l, member)}
                    onDone={() => setEditing(null)}
                  />
                </div>
              </Td>
            </tr>
          )}
        </Fragment>
      ))}
    </Table>
  );
}
