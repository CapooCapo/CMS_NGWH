import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "@/server/db/pool";
import { SESSION_COOKIE } from "./cookie";
import type { AdminRole } from "./permissions";

/**
 * Staff sessions.
 *
 * The cookie holds a 256-bit random opaque token; only its SHA-256 digest is
 * stored, so a database leak cannot be replayed as a login. Sessions are rows
 * rather than stateless JWTs specifically so an account can be revoked
 * immediately (deactivating a user must log them out).
 */
// Re-exported so callers can keep importing it from here; the constant itself
// lives in ./cookie so middleware can use it without this module's Node deps.
export { SESSION_COOKIE };

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Re-exported so existing importers keep working; the role set itself lives in
// ./permissions, which is the single source of truth for the hierarchy.
export type { AdminRole };

export type AdminIdentity = {
  id: number;
  username: string;
  email: string | null;
  role: AdminRole;
};

const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Creates a session row and returns the raw token to put in the cookie. */
export async function createSession(adminUserId: number): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    `INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [digest(token), adminUserId, expiresAt]
  );
  return { token, expiresAt };
}

/** Resolves a raw cookie token to its (active) owner, or null. */
export async function resolveSession(
  token: string | undefined
): Promise<AdminIdentity | null> {
  if (!token) return null;
  const row = await queryOne<{
    id: number;
    username: string;
    email: string | null;
    role: AdminRole;
  }>(
    `SELECT u.id, u.username, u.email, u.role
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.admin_user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.is_active = TRUE`,
    [digest(token)]
  );
  return row ?? null;
}

/** The current staff identity from the request cookies, or null. */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await query("DELETE FROM admin_sessions WHERE token_hash = $1", [
    digest(token),
  ]);
}

/** Opportunistic cleanup so expired rows do not accumulate. */
export async function purgeExpiredSessions(): Promise<void> {
  await query("DELETE FROM admin_sessions WHERE expires_at <= now()");
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // Secure is required in production; omitting it locally keeps http://localhost working.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
