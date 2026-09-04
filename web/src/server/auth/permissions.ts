/**
 * Staff role hierarchy and the account-management rules that depend on it.
 *
 * Deliberately dependency-free (no `server-only`, no database, no `next/*`)
 * for two reasons: the rules are pure functions that unit tests can call
 * directly, and the admin UI needs the same predicates to decide what to
 * render. The UI use is *presentation only* — every decision here is re-made
 * server-side in the route handlers, so a tampered payload or a hand-crafted
 * request cannot escalate privileges by lying about what the client showed.
 *
 * Hierarchy:
 *   superadmin — system administrator. The only role that may create, modify
 *                or demote a superadmin.
 *   admin      — business administrator. Unchanged from before this module.
 *   editor     — content and review.
 *   operator   — scoreboard only.
 *   subadmin   — read-only across admin-managed business content.
 */

export const ADMIN_ROLES = [
  "superadmin",
  "admin",
  "editor",
  "operator",
  "subadmin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Ranks used *only* for account-management decisions ("may this actor act on
 * that account?"). They are not a capability ladder: `editor` and `operator`
 * are parallel roles with different capabilities, not one above the other, and
 * per-endpoint capability stays with the explicit guards in `guard.ts`.
 */
const ROLE_RANK: Record<AdminRole, number> = {
  superadmin: 40,
  admin: 30,
  editor: 20,
  operator: 20,
  subadmin: 10,
};

/** Narrows an untrusted string (request body, env var, DB row) to a role. */
export function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value)
  );
}

/** Roles that bypass per-endpoint role lists entirely. */
export function isPrivileged(role: AdminRole): boolean {
  return role === "superadmin" || role === "admin";
}

export function isSuperadmin(role: AdminRole): boolean {
  return role === "superadmin";
}

/** Read-only: may view admin business content, may mutate nothing. */
export function isReadOnly(role: AdminRole): boolean {
  return role === "subadmin";
}

/* ------------------------------------------------- account management rules */

/** May open the staff-accounts screen and list accounts at all. */
export function canManageUsers(actor: AdminRole): boolean {
  return actor === "superadmin" || actor === "admin";
}

/**
 * May the actor create an account with, or assign, `target` role?
 *
 * The single rule that makes `superadmin` meaningful: only a superadmin may
 * mint or assign `superadmin`. An admin creating staff is otherwise unchanged.
 */
export function canAssignRole(actor: AdminRole, target: AdminRole): boolean {
  if (!canManageUsers(actor)) return false;
  if (target === "superadmin") return actor === "superadmin";
  return true;
}

/**
 * May the actor modify the account of someone holding `targetRole`?
 *
 * An actor may never act on an account that outranks them, which is what stops
 * an admin deactivating or demoting a superadmin. Equal rank is allowed
 * (an admin may manage another admin, preserving existing behaviour), and
 * self-modification is handled separately by `canDeactivate` / `canChangeRole`.
 */
export function canModifyUser(actor: AdminRole, targetRole: AdminRole): boolean {
  if (!canManageUsers(actor)) return false;
  return ROLE_RANK[actor] >= ROLE_RANK[targetRole];
}

export type UserRef = { id: number; role: AdminRole };

/** Reasons an account operation is refused. Stable codes for API responses. */
export type DenyReason =
  | "forbidden"
  | "cannotModifySelf"
  | "cannotModifySuperadmin"
  | "cannotAssignSuperadmin"
  | "lastSuperadmin";

export type Decision = { allowed: true } | { allowed: false; reason: DenyReason };

const allow: Decision = { allowed: true };
const deny = (reason: DenyReason): Decision => ({ allowed: false, reason });

/**
 * May `actor` activate/deactivate `target`?
 *
 * Self-deactivation stays blocked — it is the one change that can lock the
 * last administrator out of the system.
 */
export function canDeactivate(actor: UserRef, target: UserRef): Decision {
  if (!canManageUsers(actor.role)) return deny("forbidden");
  if (actor.id === target.id) return deny("cannotModifySelf");
  if (!canModifyUser(actor.role, target.role)) {
    return deny(
      target.role === "superadmin" ? "cannotModifySuperadmin" : "forbidden"
    );
  }
  return allow;
}

/**
 * May `actor` change `target`'s role to `nextRole`?
 *
 * `superadminCount` is the number of *active* superadmins, which the caller
 * reads inside the same transaction. It is required rather than optional so a
 * caller cannot accidentally skip the last-superadmin check.
 */
export function canChangeRole(
  actor: UserRef,
  target: UserRef,
  nextRole: AdminRole,
  superadminCount: number
): Decision {
  if (!canManageUsers(actor.role)) return deny("forbidden");

  // Acting on an account that outranks you is never allowed — this is what
  // prevents an admin demoting a superadmin.
  if (!canModifyUser(actor.role, target.role)) {
    return deny(
      target.role === "superadmin" ? "cannotModifySuperadmin" : "forbidden"
    );
  }

  // Only a superadmin can hand out superadmin.
  if (!canAssignRole(actor.role, nextRole)) return deny("cannotAssignSuperadmin");

  // Removing the last superadmin would leave nobody able to manage them again.
  if (
    target.role === "superadmin" &&
    nextRole !== "superadmin" &&
    superadminCount <= 1
  ) {
    return deny("lastSuperadmin");
  }

  return allow;
}

/** May `actor` create a new account with `role`? */
export function canCreateUser(actor: AdminRole, role: AdminRole): Decision {
  if (!canManageUsers(actor)) return deny("forbidden");
  if (!canAssignRole(actor, role)) return deny("cannotAssignSuperadmin");
  return allow;
}

/** Roles the actor is allowed to offer in a role selector. */
export function assignableRoles(actor: AdminRole): AdminRole[] {
  return ADMIN_ROLES.filter((role) => canAssignRole(actor, role));
}
