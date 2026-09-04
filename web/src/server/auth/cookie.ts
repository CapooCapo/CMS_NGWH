/**
 * The session cookie name, in a module with no dependencies at all.
 *
 * This exists specifically so `middleware.ts` can import it: middleware runs on
 * the Edge runtime, and importing it from `session.ts` would drag `node:crypto`
 * and the `pg` driver in with it, which the Edge runtime cannot load. Keeping
 * the constant separate is what lets the navigation guard and the real session
 * logic share one source of truth without sharing a runtime.
 *
 * Deliberately no `server-only` marker here — the value is not a secret and the
 * module must be importable from the Edge runtime.
 */
export const SESSION_COOKIE = "ngwh_admin_session";
