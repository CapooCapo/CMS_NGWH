/** Stable codes stored in `club_members.position` for player roles. */
export const PLAYER_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

/** Stable codes stored in `club_members.position` for coach/staff roles. */
export const STAFF_ROLES = [
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
  "TEAM_DOCTOR",
  "PHYSIOTHERAPIST",
  "STATISTICIAN",
  "INTERPRETER",
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];
export type ClubMemberPosition = PlayerPosition | StaffRole;

export function isPlayerPosition(value: string): value is PlayerPosition {
  return (PLAYER_POSITIONS as readonly string[]).includes(value);
}

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}
