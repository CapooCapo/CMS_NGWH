import "server-only";
import { query, queryOne } from "@/server/db/pool";
import type { Club, ClubMember, ClubMemberRole } from "./types";
import { STAFF_ROLES } from "@/lib/clubMembers";

const COLUMNS = `id, slug, name, province, founding_year, logo_url,
  achievements_en, achievements_vi, contact_email, contact_phone, website_url,
  social_links, is_approved, owner_id,
  to_char(approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS approved_at`;

export type ClubFilter = {
  /** BR-001: public callers must pass true so unapproved clubs stay hidden. */
  approvedOnly: boolean;
  province?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
};

/**
 * REQ-CLUB-001/002 — directory listing with province filter and name search.
 *
 * BR-001 is enforced here rather than in the page: `approvedOnly` is a required
 * field of the filter so a caller cannot accidentally omit it and leak pending
 * club profiles.
 */
export async function listClubs(
  filter: ClubFilter
): Promise<{ rows: Club[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.approvedOnly) where.push("is_approved = TRUE");
  if (filter.province) {
    params.push(filter.province);
    where.push(`province = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    // Case-insensitive substring on name or province.
    where.push(
      `(name ILIKE $${params.length} OR province ILIKE $${params.length})`
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM clubs ${whereSql}`,
    params
  );

  const limit = Math.min(Math.max(filter.limit ?? 24, 1), 100);
  const offset = Math.max(filter.offset ?? 0, 0);
  params.push(limit, offset);

  const rows = await query<Club>(
    `SELECT ${COLUMNS} FROM clubs ${whereSql}
      ORDER BY name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows, total: Number(totalRow?.count ?? 0) };
}

/** Distinct provinces for the filter control (REQ-CLUB-002). */
export async function listProvinces(approvedOnly: boolean): Promise<string[]> {
  const rows = await query<{ province: string }>(
    `SELECT DISTINCT province FROM clubs
      ${approvedOnly ? "WHERE is_approved = TRUE" : ""}
      ORDER BY province ASC`
  );
  return rows.map((r) => r.province);
}

/** BR-001: `approvedOnly` must be true for any public lookup. */
export function findClubBySlug(
  slug: string,
  approvedOnly: boolean
): Promise<Club | null> {
  return queryOne<Club>(
    `SELECT ${COLUMNS} FROM clubs
      WHERE slug = $1 ${approvedOnly ? "AND is_approved = TRUE" : ""}`,
    [slug]
  );
}

export function findClubById(id: number): Promise<Club | null> {
  return queryOne<Club>(`SELECT ${COLUMNS} FROM clubs WHERE id = $1`, [id]);
}

const MEMBER_COLUMNS = `id, club_id, full_name, member_role, shirt_number,
  position, birth_year, club_owner_id, is_head_coach`;
const HEAD_COACH_POSITION = STAFF_ROLES[0];

/** REQ-CLUB-005 — roster and coaching staff, players first then by number. */
export function listClubMembers(clubId: number): Promise<ClubMember[]> {
  return query<ClubMember>(
    `SELECT ${MEMBER_COLUMNS}
       FROM club_members
      WHERE club_id = $1
      ORDER BY CASE member_role
                 WHEN 'player' THEN 0 WHEN 'coach' THEN 1 ELSE 2 END,
               is_head_coach DESC,
               shirt_number NULLS LAST, full_name`,
    [clubId]
  );
}

/** One member scoped to one club, for validation before a self-service edit. */
export function findClubMember(
  clubId: number,
  memberId: number
): Promise<ClubMember | null> {
  return queryOne<ClubMember>(
    `SELECT ${MEMBER_COLUMNS} FROM club_members WHERE id = $1 AND club_id = $2`,
    [memberId, clubId]
  );
}

export type ClubInput = {
  slug: string;
  name: string;
  province: string;
  foundingYear: number | null;
  logoUrl: string | null;
  achievementsEn: string | null;
  achievementsVi: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string>;
  isApproved: boolean;
};

export function createClub(input: ClubInput): Promise<Club | null> {
  return queryOne<Club>(
    `INSERT INTO clubs (slug, name, province, founding_year, logo_url,
       achievements_en, achievements_vi, contact_email, contact_phone,
       website_url, social_links, is_approved, approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
             CASE WHEN $12 THEN now() ELSE NULL END)
     RETURNING ${COLUMNS}`,
    [
      input.slug,
      input.name,
      input.province,
      input.foundingYear,
      input.logoUrl,
      input.achievementsEn,
      input.achievementsVi,
      input.contactEmail,
      input.contactPhone,
      input.websiteUrl,
      JSON.stringify(input.socialLinks),
      input.isApproved,
    ]
  );
}

export function updateClub(
  id: number,
  input: ClubInput
): Promise<Club | null> {
  return queryOne<Club>(
    `UPDATE clubs SET slug=$2, name=$3, province=$4, founding_year=$5,
       logo_url=$6, achievements_en=$7, achievements_vi=$8, contact_email=$9,
       contact_phone=$10, website_url=$11, social_links=$12, is_approved=$13,
       approved_at = CASE
         WHEN $13 AND approved_at IS NULL THEN now()
         WHEN NOT $13 THEN NULL
         ELSE approved_at END
     WHERE id=$1 RETURNING ${COLUMNS}`,
    [
      id,
      input.slug,
      input.name,
      input.province,
      input.foundingYear,
      input.logoUrl,
      input.achievementsEn,
      input.achievementsVi,
      input.contactEmail,
      input.contactPhone,
      input.websiteUrl,
      JSON.stringify(input.socialLinks),
      input.isApproved,
    ]
  );
}

/** BR-001 approval toggle used by the admin clubs screen. */
export function setClubApproval(
  id: number,
  isApproved: boolean
): Promise<Club | null> {
  return queryOne<Club>(
    `UPDATE clubs
        SET is_approved = $2,
            approved_at = CASE WHEN $2 THEN COALESCE(approved_at, now()) ELSE NULL END
      WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, isApproved]
  );
}

export type ClubMemberInput = {
  fullName: string;
  memberRole: ClubMemberRole;
  shirtNumber: number | null;
  position: string | null;
  birthYear: number | null;
};

export function createClubMember(
  clubId: number,
  input: ClubMemberInput
): Promise<ClubMember | null> {
  return queryOne<ClubMember>(
    `INSERT INTO club_members (club_id, full_name, member_role, shirt_number, position, birth_year)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${MEMBER_COLUMNS}`,
    [
      clubId,
      input.fullName,
      input.memberRole,
      input.shirtNumber,
      input.position,
      input.birthYear,
    ]
  );
}

/**
 * Deletes one member of `clubId`.
 *
 * The head-coach row is refused: it is the registrant's own identity on the
 * club (created by approval, linked by `club_owner_id`), and deleting it
 * would permanently drop the "HLV trưởng" the approved workflow guarantees,
 * with no UI to recreate the link. Renaming it is allowed — see
 * `updateClubMember`.
 */
export async function deleteClubMember(
  clubId: number,
  memberId: number
): Promise<{ ok: true } | { ok: false; reason: "notFound" | "headCoach" }> {
  const [found] = await query<{ is_head_coach: boolean }>(
    "SELECT is_head_coach FROM club_members WHERE id = $1 AND club_id = $2",
    [memberId, clubId]
  );
  if (!found) return { ok: false, reason: "notFound" };
  if (found.is_head_coach) return { ok: false, reason: "headCoach" };

  await query("DELETE FROM club_members WHERE id = $1 AND club_id = $2", [
    memberId,
    clubId,
  ]);
  return { ok: true };
}

/**
 * The one club a Club Owner session owns, or null (an owner account may
 * exist with no club linked yet). This is the *only* place a request's "which
 * club" question is answered — never from a URL/body-supplied id.
 */
export function findClubByOwnerId(ownerId: number): Promise<Club | null> {
  return queryOne<Club>(`SELECT ${COLUMNS} FROM clubs WHERE owner_id = $1`, [
    ownerId,
  ]);
}

/**
 * A club lookup scoped to its owner in SQL. This is used for routes which do
 * carry a club id, so changing that id can never cross an ownership boundary.
 */
export function findClubByOwnerAndId(
  ownerId: number,
  clubId: number
): Promise<Club | null> {
  return queryOne<Club>(
    `SELECT ${COLUMNS} FROM clubs WHERE id = $1 AND owner_id = $2`,
    [clubId, ownerId]
  );
}

/**
 * Admin-only assignment: links (or unlinks, with `ownerId = null`) a club to
 * a Club Owner account. Never called with a client-supplied owner id that
 * wasn't just created/looked up server-side by the admin action itself.
 */
export function setClubOwner(
  clubId: number,
  ownerId: number | null
): Promise<Club | null> {
  return queryOne<Club>(
    `UPDATE clubs SET owner_id = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
    [clubId, ownerId]
  );
}

/**
 * Demotes a club's head-coach row back to an ordinary coach, unlinking it
 * from the account.
 *
 * Called when staff unassign a club's owner: the head-coach row is protected
 * from deletion precisely because it belongs to the owner, so leaving it
 * linked to a departed account would strand an undeletable row. The person's
 * name is kept — they really were on the staff — it simply stops being the
 * owner's identity.
 */
export async function clearClubHeadCoach(clubId: number): Promise<void> {
  await query(
    `UPDATE club_members
        SET is_head_coach = FALSE, club_owner_id = NULL
      WHERE club_id = $1 AND is_head_coach`,
    [clubId]
  );
}

/** REQ-CLUB-005 — edit an existing roster/coaching-staff entry. */
export function updateClubMember(
  clubId: number,
  memberId: number,
  input: ClubMemberInput
): Promise<ClubMember | null> {
  return queryOne<ClubMember>(
    // A head-coach row keeps `member_role = 'coach'` whatever the request
    // says — the CHECK constraint would reject the write anyway, and this
    // turns "role silently ignored" into the documented behaviour rather
    // than a 500 the owner cannot act on.
    `UPDATE club_members
        SET full_name = $3,
            member_role = CASE WHEN is_head_coach THEN 'coach' ELSE $4 END,
            shirt_number = $5,
            position = CASE WHEN is_head_coach THEN $8 ELSE $6 END,
            birth_year = $7
      WHERE id = $1 AND club_id = $2
      RETURNING ${MEMBER_COLUMNS}`,
    [
      memberId,
      clubId,
      input.fullName,
      input.memberRole,
      input.shirtNumber,
      input.position,
      input.birthYear,
      HEAD_COACH_POSITION,
    ]
  );
}
