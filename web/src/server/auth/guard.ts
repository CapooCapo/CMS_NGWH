import "server-only";
import { NextResponse } from "next/server";
import { currentAdmin, type AdminIdentity } from "./session";
import {
  canManageUsers,
  isPrivileged,
  isSuperadmin,
  type AdminRole,
  type DenyReason,
} from "./permissions";

/**
 * Authorization helpers for API route handlers.
 *
 * Middleware also gates `/admin/*` pages, but middleware alone is not
 * sufficient: it protects navigation, not the API surface, so authorization is
 * re-checked here on every request. Unauthenticated callers get 401,
 * authenticated-but-wrong-role get 403, and neither response leaks whether the
 * target resource exists.
 *
 * The role predicates live in `./permissions` (dependency-free, unit-testable)
 * so the same rules back both these guards and the admin UI's rendering.
 */
export type Guarded =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; response: NextResponse };

const jsonError = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

/** Any active staff account, regardless of role. */
export async function requireAdmin(): Promise<Guarded> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, response: jsonError(401, "unauthenticated") };
  return { ok: true, admin };
}

/**
 * Staff account holding one of `roles`.
 *
 * `superadmin` and `admin` are supersets of every business role, so they
 * always pass — that is how the existing endpoints keep working unchanged
 * while superadmin gains access to all of them.
 */
export async function requireRole(
  ...roles: readonly AdminRole[]
): Promise<Guarded> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (isPrivileged(guard.admin.role)) return guard;
  if (!roles.includes(guard.admin.role)) {
    return { ok: false, response: jsonError(403, "forbidden") };
  }
  return guard;
}

/**
 * Read-only access to admin business content.
 *
 * Takes the roles that may *mutate* the resource and additionally admits
 * `subadmin`, whose whole purpose is to look without touching. Callers pass
 * the same list they use for their write guard, so a read endpoint can never
 * drift wider than intended: `operator`, for instance, still gets 403 on
 * registrations because it is not in that endpoint's list.
 */
export async function requireViewer(
  ...roles: readonly AdminRole[]
): Promise<Guarded> {
  return requireRole(...roles, "subadmin");
}

/** Staff-account management: `admin` or `superadmin` only. */
export async function requireUserAdmin(): Promise<Guarded> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!canManageUsers(guard.admin.role)) {
    return { ok: false, response: jsonError(403, "forbidden") };
  }
  return guard;
}

/** System-level operations: `superadmin` only. */
export async function requireSuperadmin(): Promise<Guarded> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!isSuperadmin(guard.admin.role)) {
    return { ok: false, response: jsonError(403, "forbidden") };
  }
  return guard;
}

/**
 * Turns a `permissions` denial into a response.
 *
 * `forbidden` is a 403; the more specific refusals are 409 because the caller
 * is authorized in principle but the operation conflicts with a system
 * invariant (last superadmin, acting on yourself, outranking your own role).
 */
export function denyResponse(reason: DenyReason): NextResponse {
  const status = reason === "forbidden" ? 403 : 409;
  return NextResponse.json({ error: reason }, { status });
}
