/**
 * The Club Owner session cookie name, in a module with no dependencies at all.
 *
 * Mirrors `./cookie.ts` exactly, for the same reason: `middleware.ts` runs on
 * the Edge runtime and cannot load `node:crypto` or the `pg` driver, so the
 * constant lives here, separate from `ownerSession.ts`, which the real
 * (database-backed) session logic needs.
 *
 * A distinct cookie from `SESSION_COOKIE` (staff) — a Club Owner is a
 * different kind of principal, never staff-privileged, and the two session
 * spaces must never be confusable.
 */
export const OWNER_SESSION_COOKIE = "ngwh_owner_session";
