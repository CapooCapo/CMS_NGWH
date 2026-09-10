import "server-only";
import { query, queryOne } from "@/server/db/pool";
import type { Club } from "../types";
import { CLUB_COLUMNS } from "./shared";

export function findClubByOwnerId(ownerId: number): Promise<Club | null> { return queryOne<Club>(`SELECT ${CLUB_COLUMNS} FROM clubs WHERE owner_id = $1`, [ownerId]); }
export function findClubByOwnerAndId(ownerId: number, clubId: number): Promise<Club | null> { return queryOne<Club>(`SELECT ${CLUB_COLUMNS} FROM clubs WHERE id = $1 AND owner_id = $2`, [clubId, ownerId]); }
export function setClubOwner(clubId: number, ownerId: number | null): Promise<Club | null> { return queryOne<Club>(`UPDATE clubs SET owner_id = $2 WHERE id = $1 RETURNING ${CLUB_COLUMNS}`, [clubId, ownerId]); }
export async function clearClubHeadCoach(clubId: number): Promise<void> { await query(`UPDATE club_members SET is_head_coach = FALSE, club_owner_id = NULL WHERE club_id = $1 AND is_head_coach`, [clubId]); }
