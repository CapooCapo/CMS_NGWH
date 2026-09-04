import "server-only";
import { NextResponse } from "next/server";
import { currentOwner, type OwnerIdentity } from "./ownerSession";
import { findClubByOwnerId } from "@/server/repositories/clubs";
import type { Club } from "@/server/repositories/types";

/**
 * Authorization helpers for Club Owner API routes — the same shape as
 * `./guard.ts`, deliberately kept separate so a bug in one guard chain can
 * never widen the other.
 *
 * Ownership is always resolved server-side from the session, never from a
 * client-supplied club id: `requireOwnedClub()` looks up "the club this
 * session owns" (`clubs.owner_id = <session owner id>`), so a request cannot
 * assert someone else's club by editing a URL or a request body.
 */
export type OwnerGuarded =
  | { ok: true; owner: OwnerIdentity }
  | { ok: false; response: NextResponse };

export type OwnedClubGuarded =
  | { ok: true; owner: OwnerIdentity; club: Club }
  | { ok: false; response: NextResponse };

const jsonError = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

/** Any active Club Owner session. */
export async function requireOwner(): Promise<OwnerGuarded> {
  const owner = await currentOwner();
  if (!owner) return { ok: false, response: jsonError(401, "unauthenticated") };
  return { ok: true, owner };
}

/**
 * An active Club Owner session that owns a club right now.
 *
 * Distinct 404 (not 403) for "no club assigned yet" — this is a normal state
 * (an owner account can exist before a club is linked to it), not a
 * permission failure.
 */
export async function requireOwnedClub(): Promise<OwnedClubGuarded> {
  const guard = await requireOwner();
  if (!guard.ok) return guard;
  const club = await findClubByOwnerId(guard.owner.id);
  if (!club) return { ok: false, response: jsonError(404, "noClubAssigned") };
  return { ok: true, owner: guard.owner, club };
}
