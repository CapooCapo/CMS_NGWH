import "server-only";
import { query, queryOne, transaction } from "@/server/db/pool";
import type { ClubRegistration, RegistrationStatus } from "./types";

const COLUMNS = `id, club_name, operating_region, representative_name,
  representative_email, representative_phone, notes, status, review_note,
  to_char(reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS reviewed_at,
  club_id, club_owner_id,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at`;

export type RegistrationInput = {
  /**
   * The account submitting this. Always taken from the authenticated session
   * in the route handler — `parseRegistration` does not read it from the
   * form, so a client cannot register a club "as" somebody else.
   */
  clubOwnerId: number | null;
  clubName: string;
  operatingRegion: string;
  representativeName: string;
  representativeEmail: string;
  representativePhone: string | null;
  notes: string | null;
};

export type UploadedDocument = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

/**
 * REQ-REG-001/002/003 — persists a submission and its uploads atomically, so a
 * failed document insert cannot leave a registration with partial attachments.
 */
export function createRegistration(
  input: RegistrationInput,
  documents: readonly UploadedDocument[]
): Promise<ClubRegistration> {
  return transaction(async (client) => {
    const { rows } = await client.query<ClubRegistration>(
      `INSERT INTO club_registrations (club_name, operating_region,
         representative_name, representative_email, representative_phone, notes,
         club_owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COLUMNS}`,
      [
        input.clubName,
        input.operatingRegion,
        input.representativeName,
        input.representativeEmail,
        input.representativePhone,
        input.notes,
        input.clubOwnerId,
      ]
    );
    const registration = rows[0];
    for (const doc of documents) {
      await client.query(
        `INSERT INTO registration_documents
           (registration_id, filename, content_type, byte_size, content)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          registration.id,
          doc.filename,
          doc.contentType,
          doc.bytes.byteLength,
          doc.bytes,
        ]
      );
    }
    return registration;
  });
}

/**
 * "My registration" — the newest submission belonging to one account.
 *
 * Scoped by `club_owner_id` in the query itself, so this is also the
 * authorization check: there is no registration id in the caller's hands to
 * tamper with, and one account can never read another's submission.
 */
export function findLatestRegistrationForOwner(
  clubOwnerId: number
): Promise<ClubRegistration | null> {
  return queryOne<ClubRegistration>(
    `SELECT ${COLUMNS} FROM club_registrations
      WHERE club_owner_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [clubOwnerId]
  );
}

/** All submissions belonging to one authenticated account, newest first. */
export function listRegistrationsForOwner(
  clubOwnerId: number
): Promise<ClubRegistration[]> {
  return query<ClubRegistration>(
    `SELECT ${COLUMNS} FROM club_registrations
      WHERE club_owner_id = $1
      ORDER BY created_at DESC, id DESC`,
    [clubOwnerId]
  );
}

export type RegistrationListItem = ClubRegistration & {
  document_count: number;
};

export function listRegistrations(
  status?: RegistrationStatus | null
): Promise<RegistrationListItem[]> {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    params.push(status);
    where = "WHERE r.status = $1";
  }
  return query<RegistrationListItem>(
    `SELECT r.id, r.club_name, r.operating_region, r.representative_name,
            r.representative_email, r.representative_phone, r.notes, r.status,
            r.review_note,
            to_char(r.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS reviewed_at,
            r.club_id,
            to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
            (SELECT COUNT(*) FROM registration_documents d
              WHERE d.registration_id = r.id)::int AS document_count
       FROM club_registrations r
       ${where}
       ORDER BY r.created_at DESC`,
    params
  );
}

export function findRegistrationById(
  id: number
): Promise<ClubRegistration | null> {
  return queryOne<ClubRegistration>(
    `SELECT ${COLUMNS} FROM club_registrations WHERE id = $1`,
    [id]
  );
}

export type RegistrationDocumentMeta = {
  id: number;
  filename: string;
  content_type: string;
  byte_size: number;
  is_public: boolean;
};

export function listRegistrationDocuments(
  registrationId: number
): Promise<RegistrationDocumentMeta[]> {
  return query<RegistrationDocumentMeta>(
    `SELECT id, filename, content_type, byte_size, is_public
       FROM registration_documents
      WHERE registration_id = $1 ORDER BY id`,
    [registrationId]
  );
}

export function findRegistrationDocument(
  registrationId: number,
  documentId: number
): Promise<{
  filename: string;
  content_type: string;
  content: Buffer;
} | null> {
  return queryOne(
    `SELECT filename, content_type, content
       FROM registration_documents
      WHERE registration_id = $1 AND id = $2`,
    [registrationId, documentId]
  );
}

/**
 * A reviewer opting a document in to (or out of) the club's public profile.
 * Scoped by registration id, matching the download route's scoping.
 */
export function setDocumentVisibility(
  registrationId: number,
  documentId: number,
  isPublic: boolean
): Promise<RegistrationDocumentMeta | null> {
  return queryOne<RegistrationDocumentMeta>(
    `UPDATE registration_documents
        SET is_public = $3
      WHERE registration_id = $1 AND id = $2
      RETURNING id, filename, content_type, byte_size, is_public`,
    [registrationId, documentId, isPublic]
  );
}

export type PublicClubDocument = {
  id: number;
  filename: string;
  content_type: string;
  byte_size: number;
};

/** All documents for an approved club's registration are public together. */
export function listPublicClubDocuments(
  clubId: number
): Promise<PublicClubDocument[]> {
  return query<PublicClubDocument>(
    `SELECT d.id, d.filename, d.content_type, d.byte_size
       FROM registration_documents d
       JOIN club_registrations r ON r.id = d.registration_id
      WHERE r.club_id = $1 AND r.status = 'approved'
      ORDER BY d.id`,
    [clubId]
  );
}

/**
 * Every document belonging to a club's registration, public or not — for the
 * Club Owner's own "Documents" view (they may see their own private uploads;
 * `is_public` tells the UI which ones a visitor can also reach).
 */
export function listRegistrationDocumentsForClub(
  clubId: number
): Promise<RegistrationDocumentMeta[]> {
  return query<RegistrationDocumentMeta>(
    `SELECT d.id, d.filename, d.content_type, d.byte_size, d.is_public
       FROM registration_documents d
       JOIN club_registrations r ON r.id = d.registration_id
      WHERE r.club_id = $1
      ORDER BY d.id`,
    [clubId]
  );
}

/** Every document for a club's registration, for its authenticated owner. */
export function findRegistrationDocumentForClub(
  clubId: number,
  documentId: number
): Promise<{
  filename: string;
  content_type: string;
  content: Buffer;
} | null> {
  return queryOne(
    `SELECT d.filename, d.content_type, d.content
       FROM registration_documents d
       JOIN club_registrations r ON r.id = d.registration_id
      WHERE r.club_id = $1 AND d.id = $2`,
    [clubId, documentId]
  );
}

export function findPublicClubDocument(
  clubId: number,
  documentId: number
): Promise<{
  filename: string;
  content_type: string;
  content: Buffer;
} | null> {
  return queryOne(
    `SELECT d.filename, d.content_type, d.content
       FROM registration_documents d
       JOIN club_registrations r ON r.id = d.registration_id
      WHERE r.club_id = $1 AND d.id = $2 AND r.status = 'approved'`,
    [clubId, documentId]
  );
}

/** Records the review outcome. Linking to a created club is done by the service. */
export function setRegistrationStatus(
  id: number,
  status: RegistrationStatus,
  reviewNote: string | null,
  clubId: number | null
): Promise<ClubRegistration | null> {
  return queryOne<ClubRegistration>(
    `UPDATE club_registrations
        SET status = $2, review_note = $3, reviewed_at = now(),
            club_id = COALESCE($4, club_id)
      WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, status, reviewNote, clubId]
  );
}

export async function countRegistrationsByStatus(): Promise<
  Record<RegistrationStatus, number>
> {
  const rows = await query<{ status: RegistrationStatus; count: string }>(
    "SELECT status, COUNT(*)::text AS count FROM club_registrations GROUP BY status"
  );
  const out: Record<RegistrationStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  for (const row of rows) out[row.status] = Number(row.count);
  return out;
}
