import "server-only";
import { query, queryOne } from "@/server/db/pool";
import {
  ADMIN_PAGE_SIZE,
  resolvePagination,
  type PaginatedResult,
} from "@/lib/pagination";
import type { ContactMessage, ContactStatus } from "./types";

const COLUMNS = `id, name, email, subject, message, locale, status,
  to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS created_at`;

/**
 * REQ-CONTACT-002 — feedback submissions.
 *
 * OQ-014 (fields and routing) is Open, so submissions are stored and shown in
 * the admin inbox; nothing is emailed or forwarded, because no destination has
 * been decided.
 */
export type ContactInput = {
  name: string;
  email: string;
  subject: string | null;
  message: string;
  locale: string;
};

export function createContactMessage(
  input: ContactInput
): Promise<ContactMessage | null> {
  return queryOne<ContactMessage>(
    `INSERT INTO contact_messages (name, email, subject, message, locale)
     VALUES ($1,$2,$3,$4,$5) RETURNING ${COLUMNS}`,
    [input.name, input.email, input.subject, input.message, input.locale]
  );
}

export function listContactMessages(
  status?: ContactStatus | null
): Promise<ContactMessage[]> {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    params.push(status);
    where = "WHERE status = $1";
  }
  return query<ContactMessage>(
    `SELECT ${COLUMNS} FROM contact_messages ${where} ORDER BY created_at DESC`,
    params
  );
}

/** Bounded inbox slice for the admin table. */
export async function listAdminContactMessages(
  status: ContactStatus | null,
  requestedPage: number
): Promise<PaginatedResult<ContactMessage>> {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    params.push(status);
    where = "WHERE status = $1";
  }
  const totalRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM contact_messages ${where}`,
    params
  );
  const pagination = resolvePagination(
    requestedPage,
    Number(totalRow?.count ?? 0),
    ADMIN_PAGE_SIZE
  );
  const rows = await query<ContactMessage>(
    `SELECT ${COLUMNS} FROM contact_messages ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pagination.pageSize, pagination.offset]
  );
  return { ...pagination, rows };
}

export function setContactStatus(
  id: number,
  status: ContactStatus
): Promise<ContactMessage | null> {
  return queryOne<ContactMessage>(
    `UPDATE contact_messages SET status = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, status]
  );
}

export async function countNewContactMessages(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM contact_messages WHERE status = 'new'"
  );
  return Number(row?.count ?? 0);
}
