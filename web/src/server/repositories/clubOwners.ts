import "server-only";
import { query, queryOne, transaction } from "@/server/db/pool";
import type { Club } from "./types";

export type ClubOwner = {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
};

const COLUMNS = `id, email, full_name, is_active,
  to_char(last_login_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS last_login_at`;

const CLUB_COLUMNS = `id, slug, name, province, founding_year, logo_url,
  achievements_en, achievements_vi, contact_email, contact_phone, website_url,
  social_links, is_approved, owner_id,
  to_char(approved_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS approved_at`;

/** Includes the hash — only the owner login route may use this. */
export function findClubOwnerByEmailWithHash(email: string): Promise<
  (ClubOwner & { password_hash: string }) | null
> {
  return queryOne<ClubOwner & { password_hash: string }>(
    `SELECT ${COLUMNS}, password_hash FROM club_owners
      WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
}

export function findClubOwnerById(id: number): Promise<ClubOwner | null> {
  return queryOne<ClubOwner>(`SELECT ${COLUMNS} FROM club_owners WHERE id = $1`, [
    id,
  ]);
}

/**
 * Self-service account profile edit. The id comes from `currentOwner()` in
 * the route handler; email, active status and credentials are intentionally
 * outside this account-profile surface.
 */
export function updateClubOwnerProfile(
  id: number,
  input: { fullName: string }
): Promise<ClubOwner | null> {
  return queryOne<ClubOwner>(
    `UPDATE club_owners SET full_name = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, input.fullName]
  );
}

export async function recordOwnerLogin(id: number): Promise<void> {
  await query("UPDATE club_owners SET last_login_at = now() WHERE id = $1", [id]);
}

/**
 * Creates an owner account and links it to `clubId` in one transaction —
 * the admin-only "assign/create Club Owner" action (REQ-REG-004 shape,
 * implemented for this pass). If the club already has an owner, the caller
 * must unassign it first (`setClubOwner(clubId, null)`); this never silently
 * replaces an existing owner.
 */
export async function createAndAssignClubOwner(
  clubId: number,
  input: { email: string; passwordHash: string }
): Promise<
  | { ok: true; owner: ClubOwner }
  | { ok: false; reason: "clubNotFound" | "clubAlreadyOwned" | "emailTaken" }
> {
  return transaction(async (client) => {
    const { rows: clubRows } = await client.query<{ id: number; owner_id: number | null }>(
      "SELECT id, owner_id FROM clubs WHERE id = $1 FOR UPDATE",
      [clubId]
    );
    const club = clubRows[0];
    if (!club) return { ok: false as const, reason: "clubNotFound" as const };
    if (club.owner_id) return { ok: false as const, reason: "clubAlreadyOwned" as const };

    const { rows: existing } = await client.query<{ id: number }>(
      "SELECT id FROM club_owners WHERE LOWER(email) = LOWER($1)",
      [input.email]
    );
    if (existing.length > 0) return { ok: false as const, reason: "emailTaken" as const };

    const { rows: created } = await client.query<ClubOwner>(
      `INSERT INTO club_owners (email, password_hash) VALUES ($1, $2)
       RETURNING ${COLUMNS}`,
      [input.email, input.passwordHash]
    );
    const owner = created[0];

    await client.query("UPDATE clubs SET owner_id = $2 WHERE id = $1", [
      clubId,
      owner.id,
    ]);

    return { ok: true as const, owner };
  });
}

/**
 * Self-service signup — a person creating their own account before they have
 * any club. This is the entry point of the "sign up → log in → register a
 * club → get approved" workflow, so it deliberately grants nothing: the new
 * row has no club, and ownership only ever arrives later via admin approval
 * of a registration. There is no role or club id to supply, by construction.
 */
export async function createClubOwnerAccount(input: {
  email: string;
  fullName: string;
  passwordHash: string;
}): Promise<{ ok: true; owner: ClubOwner } | { ok: false; reason: "emailTaken" }> {
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM club_owners WHERE LOWER(email) = LOWER($1)",
    [input.email]
  );
  if (existing) return { ok: false, reason: "emailTaken" };

  try {
    const owner = await queryOne<ClubOwner>(
      `INSERT INTO club_owners (email, full_name, password_hash)
       VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [input.email, input.fullName, input.passwordHash]
    );
    return { ok: true, owner: owner! };
  } catch (error) {
    // The LOWER(email) unique index is the real arbiter — two concurrent
    // signups for the same address race past the SELECT above.
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, reason: "emailTaken" };
    }
    throw error;
  }
}

export async function deactivateClubOwner(id: number): Promise<ClubOwner | null> {
  return queryOne<ClubOwner>(
    `UPDATE club_owners SET is_active = FALSE WHERE id = $1 RETURNING ${COLUMNS}`,
    [id]
  );
}

/**
 * Releases a club owner, their linked head-coach relationship, and their
 * access in one transaction. The club row is locked first because ownership
 * is the scope of every owner request and must not be partially changed.
 */
export async function unassignClubOwner(
  clubId: number
): Promise<{ ok: true; club: Club } | { ok: false; reason: "clubNotFound" }> {
  return transaction(async (client) => {
    const { rows: found } = await client.query<{ id: number; owner_id: number | null }>(
      "SELECT id, owner_id FROM clubs WHERE id = $1 FOR UPDATE",
      [clubId]
    );
    const existing = found[0];
    if (!existing) return { ok: false, reason: "clubNotFound" };

    const { rows: unlinked } = await client.query<Club>(
      `UPDATE clubs SET owner_id = NULL WHERE id = $1 RETURNING ${CLUB_COLUMNS}`,
      [clubId]
    );

    // The head-coach row is the owner's identity on the roster. Preserve the
    // person as an ordinary coach, but remove the ownership-only relationship.
    await client.query(
      `UPDATE club_members
          SET is_head_coach = FALSE, club_owner_id = NULL
        WHERE club_id = $1 AND is_head_coach`,
      [clubId]
    );

    // An inactive account's existing opaque sessions stop resolving on their
    // next request, so no separate session mutation is needed.
    if (existing.owner_id) {
      await client.query("UPDATE club_owners SET is_active = FALSE WHERE id = $1", [
        existing.owner_id,
      ]);
    }

    return { ok: true, club: unlinked[0] };
  });
}
