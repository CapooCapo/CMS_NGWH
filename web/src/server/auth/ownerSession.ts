import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "@/server/db/pool";
import { OWNER_SESSION_COOKIE } from "./ownerCookie";

/**
 * Club Owner sessions.
 *
 * Same design as staff sessions (`./session.ts`): a 256-bit opaque token in
 * the cookie, only its SHA-256 digest stored, so a database leak cannot be
 * replayed as a login, and a row (not a JWT) so deactivating an owner logs
 * them out immediately.
 */
export { OWNER_SESSION_COOKIE };

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours, matching staff sessions

export type OwnerIdentity = {
  id: number;
  email: string;
  /** Null for admin-created accounts predating self-service signup. */
  full_name: string | null;
};

const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function createOwnerSession(clubOwnerId: number): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    `INSERT INTO club_owner_sessions (token_hash, club_owner_id, expires_at)
     VALUES ($1, $2, $3)`,
    [digest(token), clubOwnerId, expiresAt]
  );
  return { token, expiresAt };
}

export async function resolveOwnerSession(
  token: string | undefined
): Promise<OwnerIdentity | null> {
  if (!token) return null;
  const row = await queryOne<OwnerIdentity>(
    `SELECT o.id, o.email, o.full_name
       FROM club_owner_sessions s
       JOIN club_owners o ON o.id = s.club_owner_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND o.is_active = TRUE`,
    [digest(token)]
  );
  return row ?? null;
}

/** The current Club Owner identity from the request cookies, or null. */
export async function currentOwner(): Promise<OwnerIdentity | null> {
  const store = await cookies();
  return resolveOwnerSession(store.get(OWNER_SESSION_COOKIE)?.value);
}

export async function destroyOwnerSession(
  token: string | undefined
): Promise<void> {
  if (!token) return;
  await query("DELETE FROM club_owner_sessions WHERE token_hash = $1", [
    digest(token),
  ]);
}

/** Opportunistic cleanup so expired rows do not accumulate. */
export async function purgeExpiredOwnerSessions(): Promise<void> {
  await query("DELETE FROM club_owner_sessions WHERE expires_at <= now()");
}

export function ownerSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
