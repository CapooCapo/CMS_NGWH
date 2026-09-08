import "server-only";
import { transaction } from "@/server/db/pool";
import { STAFF_ROLES } from "@/lib/clubMembers";
import type { ClubRegistration, RegistrationStatus } from "@/server/repositories/types";

/**
 * BR-001 / REQ-CLUB-003 — approving a club registration.
 *
 * Approval is the moment a club profile becomes public, so the two writes
 * (create/flag the club, stamp the registration) happen in one transaction: a
 * half-applied approval would either publish a club with no audit trail or
 * mark a registration approved with no visible profile.
 *
 * OQ-010 ("which role approves") is Open. Route-level authorization requires an
 * `admin` role; when OQ-010 is answered, only the guard changes, not this
 * service.
 *
 * Rejection never creates or unpublishes a club — it only records the outcome,
 * which keeps the action reversible.
 *
 * Approval is also the moment the *registrant* becomes the club's owner and
 * head coach ("chủ CLB / HLV trưởng"). All of it — club row, ownership link,
 * head-coach member row, registration stamp — happens in this one
 * transaction, because a half-applied approval would leave a published club
 * that nobody can administer, or an owner pointing at a club that was never
 * created. The owner id comes from `registration.club_owner_id`, which the
 * intake route filled from the authenticated session; nothing here reads an
 * owner id supplied by whoever clicked Approve.
 */

/**
 * Stored on the head-coach member row's `position`. This is a stable domain
 * code; UI surfaces translate it for display.
 */
const HEAD_COACH_POSITION = STAFF_ROLES[0];

const REGISTRATION_COLUMNS = `id, club_name, operating_region, representative_name,
  representative_email, representative_phone, notes, status, review_note,
  to_char(reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS reviewed_at,
  club_id, club_owner_id,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at`;

export type ReviewConflict =
  | "invalidReviewTransition"
  | "ownershipConflict"
  | "registrantUnavailable";

export type ApprovalResult =
  | { kind: "approved"; registration: ClubRegistration; clubId: number | null }
  | { kind: "notFound" }
  | { kind: ReviewConflict };

export type RejectionResult =
  | { kind: "rejected"; registration: ClubRegistration }
  | { kind: "notFound" }
  | { kind: "invalidReviewTransition" };

export type RegistrationDeletionResult =
  | { kind: "deleted" }
  | { kind: "notFound" }
  | { kind: "deletionNotAllowed" };

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "club"
  );
}

export async function approveRegistration(
  registrationId: number,
  afterSuccess?: (result: Extract<ApprovalResult, { kind: "approved" }>) => Promise<void>
): Promise<ApprovalResult> {
  return transaction(async (client) => {
    const { rows: found } = await client.query<ClubRegistration>(
      `SELECT ${REGISTRATION_COLUMNS}
         FROM club_registrations WHERE id = $1 FOR UPDATE`,
      [registrationId]
    );
    const registration = found[0];
    if (!registration) return { kind: "notFound" };

    // Terminal decisions are immutable. Repeating the same action is a true
    // no-op: return the stored outcome without replacing its timestamp.
    if (registration.status === "approved") {
      const result = {
        kind: "approved",
        registration,
        clubId: registration.club_id,
      } as const;
      await afterSuccess?.(result);
      return result;
    }
    if (registration.status !== "pending") {
      return { kind: "invalidReviewTransition" };
    }

    let owner: { id: number; full_name: string | null; is_active: boolean } | null = null;

    /*
     * Registrations predating authenticated intake intentionally have no
     * owner and retain the former publish-only behaviour. Every registration
     * with an owner, however, must verify that the account still exists and
     * is active before any club can be created or published.
     */
    if (registration.club_owner_id) {
      const { rows: ownerRows } = await client.query<{
        id: number;
        full_name: string | null;
        is_active: boolean;
      }>("SELECT id, full_name, is_active FROM club_owners WHERE id = $1 FOR UPDATE", [
        registration.club_owner_id,
      ]);
      owner = ownerRows[0] ?? null;
      if (!owner?.is_active) return { kind: "registrantUnavailable" };

      // Locking the owner account serializes approval with owner lifecycle
      // writes. Do not ever free another club merely to satisfy the one-club
      // unique index: an existing ownership link is a business conflict.
      const { rows: ownedClubs } = await client.query<{ id: number }>(
        "SELECT id FROM clubs WHERE owner_id = $1 FOR UPDATE",
        [owner.id]
      );
      if (ownedClubs[0]) return { kind: "ownershipConflict" };
    }

    let clubId = registration.club_id;

    if (clubId) {
      const { rows: clubRows } = await client.query<{ id: number; owner_id: number | null }>(
        "SELECT id, owner_id FROM clubs WHERE id = $1 FOR UPDATE",
        [clubId]
      );
      const club = clubRows[0];

      // Legacy rows do not claim an owner, but owner-backed registrations
      // must never attach to an occupied target club.
      if (!club || (owner && club.owner_id !== null)) {
        return { kind: "ownershipConflict" };
      }

      await client.query(
        `UPDATE clubs SET is_approved = TRUE, approved_at = COALESCE(approved_at, now())
          WHERE id = $1`,
        [clubId]
      );
    } else {
      // Slug must be unique; append -2, -3, … on collision.
      const base = slugify(registration.club_name);
      let slug = base;
      for (let n = 2; ; n++) {
        const { rows } = await client.query<{ id: number }>(
          "SELECT id FROM clubs WHERE slug = $1",
          [slug]
        );
        if (rows.length === 0) break;
        slug = `${base}-${n}`;
      }
      const { rows: created } = await client.query<{ id: number }>(
        `INSERT INTO clubs (slug, name, province, contact_email, contact_phone,
           is_approved, approved_at)
         VALUES ($1,$2,$3,$4,$5,TRUE,now()) RETURNING id`,
        [
          slug,
          registration.club_name,
          registration.operating_region,
          registration.representative_email,
          registration.representative_phone,
        ]
      );
      clubId = created[0].id;
    }

    if (owner) {
      await client.query("UPDATE clubs SET owner_id = $2 WHERE id = $1", [
        clubId,
        owner.id,
      ]);

      /*
       * The registrant's own Head Coach entry — created from their account,
       * so they never retype themselves as a new coach. The registration lock
       * makes the first approval the only write; retrying it returns above.
       */
      const headCoachName = owner.full_name?.trim() || registration.representative_name;
      const { rows: existingHead } = await client.query<{ id: number }>(
        "SELECT id FROM club_members WHERE club_id = $1 AND is_head_coach",
        [clubId]
      );
      if (existingHead[0]) {
        await client.query(
          `UPDATE club_members
              SET full_name = $2, club_owner_id = $3, member_role = 'coach'
            WHERE id = $1`,
          [existingHead[0].id, headCoachName, owner.id]
        );
      } else {
        await client.query(
          `INSERT INTO club_members
             (club_id, full_name, member_role, position, club_owner_id, is_head_coach)
           VALUES ($1, $2, 'coach', $3, $4, TRUE)`,
          [clubId, headCoachName, HEAD_COACH_POSITION, owner.id]
        );
      }
    }

    const { rows: updated } = await client.query<ClubRegistration>(
      `UPDATE club_registrations
          SET status = 'approved', review_note = NULL, reviewed_at = now(), club_id = $2
        WHERE id = $1
        RETURNING ${REGISTRATION_COLUMNS}`,
      [registrationId, clubId]
    );
    const result = { kind: "approved", registration: updated[0], clubId } as const;
    await afterSuccess?.(result);
    return result;
  });
}

export async function rejectRegistration(
  registrationId: number,
  afterSuccess?: (result: Extract<RejectionResult, { kind: "rejected" }>) => Promise<void>
): Promise<RejectionResult> {
  return transaction(async (client) => {
    const { rows: found } = await client.query<ClubRegistration>(
      `SELECT ${REGISTRATION_COLUMNS}
         FROM club_registrations WHERE id = $1 FOR UPDATE`,
      [registrationId]
    );
    const registration = found[0];
    if (!registration) return { kind: "notFound" };
    if (registration.status === "rejected") {
      const result = { kind: "rejected", registration } as const;
      await afterSuccess?.(result);
      return result;
    }
    if (registration.status !== "pending") {
      return { kind: "invalidReviewTransition" };
    }

    const { rows } = await client.query<ClubRegistration>(
      `UPDATE club_registrations
          SET status = 'rejected', review_note = NULL, reviewed_at = now()
        WHERE id = $1
        RETURNING ${REGISTRATION_COLUMNS}`,
      [registrationId]
    );
    const result = { kind: "rejected", registration: rows[0] } as const;
    await afterSuccess?.(result);
    return result;
  });
}

/**
 * Permanently removes an unapproved registration and its upload rows. The
 * registration lock serializes this with approve/reject, and the database's
 * existing ON DELETE CASCADE removes only its registration documents. An
 * approved registration is never deleted here: its club may be referenced by
 * competition and ownership records, so retention needs an explicit policy.
 */
export async function deleteRegistration(
  registrationId: number,
  afterSuccess?: () => Promise<void>
): Promise<RegistrationDeletionResult> {
  return transaction(async (client) => {
    const { rows } = await client.query<{ status: RegistrationStatus }>(
      "SELECT status FROM club_registrations WHERE id = $1 FOR UPDATE",
      [registrationId]
    );
    const registration = rows[0];
    if (!registration) return { kind: "notFound" };
    if (registration.status === "approved") return { kind: "deletionNotAllowed" };

    await client.query("DELETE FROM club_registrations WHERE id = $1", [registrationId]);
    await afterSuccess?.();
    return { kind: "deleted" };
  });
}

export type ReviewAction = Extract<RegistrationStatus, "approved" | "rejected">;
