import "server-only";
import { query, queryOne } from "@/server/db/pool";
import type { ClubMember } from "../types";
import { HEAD_COACH_POSITION, MEMBER_COLUMNS, type ClubMemberInput } from "./shared";

export function listClubMembers(clubId: number): Promise<ClubMember[]> { return query<ClubMember>(`SELECT ${MEMBER_COLUMNS} FROM club_members WHERE club_id = $1 ORDER BY CASE member_role WHEN 'player' THEN 0 WHEN 'coach' THEN 1 ELSE 2 END, is_head_coach DESC, shirt_number NULLS LAST, full_name`, [clubId]); }
export function findClubMember(clubId: number, memberId: number): Promise<ClubMember | null> { return queryOne<ClubMember>(`SELECT ${MEMBER_COLUMNS} FROM club_members WHERE id = $1 AND club_id = $2`, [memberId, clubId]); }
export function createClubMember(clubId: number, input: ClubMemberInput): Promise<ClubMember | null> { return queryOne<ClubMember>(`INSERT INTO club_members (club_id, full_name, member_role, shirt_number, position, birth_year) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${MEMBER_COLUMNS}`, [clubId, input.fullName, input.memberRole, input.shirtNumber, input.position, input.birthYear]); }
export async function deleteClubMember(clubId: number, memberId: number): Promise<{ ok: true } | { ok: false; reason: "notFound" | "headCoach" }> {
  const [found] = await query<{ is_head_coach: boolean }>("SELECT is_head_coach FROM club_members WHERE id = $1 AND club_id = $2", [memberId, clubId]);
  if (!found) return { ok: false, reason: "notFound" };
  if (found.is_head_coach) return { ok: false, reason: "headCoach" };
  await query("DELETE FROM club_members WHERE id = $1 AND club_id = $2", [memberId, clubId]);
  return { ok: true };
}
export function updateClubMember(clubId: number, memberId: number, input: ClubMemberInput): Promise<ClubMember | null> { return queryOne<ClubMember>(`UPDATE club_members SET full_name = $3, member_role = CASE WHEN is_head_coach THEN 'coach' ELSE $4 END, shirt_number = $5, position = CASE WHEN is_head_coach THEN $8 ELSE $6 END, birth_year = $7 WHERE id = $1 AND club_id = $2 RETURNING ${MEMBER_COLUMNS}`, [memberId, clubId, input.fullName, input.memberRole, input.shirtNumber, input.position, input.birthYear, HEAD_COACH_POSITION]); }
