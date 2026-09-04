import "server-only";
import { query, queryOne } from "@/server/db/pool";
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
