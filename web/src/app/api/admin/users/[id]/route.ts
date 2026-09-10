import { denyResponse, requireUserAdmin } from "@/server/auth/guard";
import {
  canChangeRole,
  canDeactivate,
  isAdminRole,
  type AdminRole,
} from "@/server/auth/permissions";
import {
  changeAdminUserRole,
  findAdminUserById,
  setAdminUserActive,
} from "@/server/repositories/adminUsers";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { Validator, readJson } from "@/server/validation/validate";
import { auditAdminMutation } from "@/server/security/adminAudit";
import { transaction } from "@/server/db/pool";

/**
 * Update one staff account: activate/deactivate and/or change role.
 *
 * Everything is decided from the *session* role, never from the request body.
 * The hierarchy rules live in `@/server/auth/permissions` and are applied here
 * as well as reflected in the UI; the UI copy is presentation only.
 *
 * Invariants enforced:
 *  - nobody may act on an account that outranks them, so an admin can neither
 *    deactivate nor demote a superadmin;
 *  - only a superadmin may assign the superadmin role;
 *  - nobody may modify their own account's role or active flag;
 *  - the last active superadmin can be neither demoted nor deactivated.
 *
 * The last two role/active checks run inside the repository transaction with
 * the target row locked, so two concurrent requests cannot both pass a check
 * that was only true for one of them.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUserAdmin();
  if (!guard.ok) return guard.response;

  const id = parseId((await params).id);
  if (!id) return notFound();

  try {
    const body = await readJson(request);
    const v = new Validator(body);

    /*
     * `role` is optional: this endpoint handles both activation and role
     * changes. When present it is matched *exactly* against the known set —
     * no trimming, no case folding — because it drives an authorization
     * decision and a database CHECK constraint. The shared `Validator.enum`
     * trims first, which would quietly accept `"admin "`.
     */
    const hasRole =
      Object.prototype.hasOwnProperty.call(body, "role") && body.role !== null;
    if (hasRole && !isAdminRole(body.role)) v.errors.role ??= "invalidChoice";
    v.assert();
    const nextRole = hasRole ? (body.role as AdminRole) : null;

    const hasActive = Object.prototype.hasOwnProperty.call(body, "isActive");
    if (!hasActive && !nextRole) {
      return ok({ error: "nothingToUpdate" }, 400);
    }

    const target = await findAdminUserById(id);
    if (!target) return notFound();

    const actor = { id: guard.admin.id, role: guard.admin.role };
    const targetRef = { id: target.id, role: target.role };

    return await transaction(async () => {
    if (nextRole) {
      // Self-role-change is refused outright: a superadmin demoting themselves
      // is the fastest way to lose control of the system, and an admin
      // promoting themselves is the escalation this whole module prevents.
      if (actor.id === targetRef.id) return denyResponse("cannotModifySelf");

      const result = await changeAdminUserRole(id, nextRole, (locked, supers) => {
        const decision = canChangeRole(actor, locked, nextRole, supers);
        return decision.allowed ? null : decision.reason;
      });
      if (!result.ok) {
        return result.reason === "notFound"
          ? notFound()
          : denyResponse(result.reason as never);
      }
      if (!hasActive) {
        await auditAdminMutation(request, {
          actorId: guard.admin.id, action: "role.assign", resourceType: "admin_user", resourceId: id,
          metadata: { from: target.role, to: nextRole },
        });
        return ok({ user: result.user });
      }
    }

    if (hasActive) {
      const isActive = body.isActive === true;
      const decision = canDeactivate(actor, targetRef);
      if (!decision.allowed) return denyResponse(decision.reason);

      const result = await setAdminUserActive(id, isActive, (locked, supers) => {
        // Deactivating the last active superadmin is refused for the same
        // reason demoting them is.
        if (
          !isActive &&
          locked.role === "superadmin" &&
          supers <= 1
        ) {
          return "lastSuperadmin";
        }
        return null;
      });
      if (!result.ok) {
        return result.reason === "notFound"
          ? notFound()
          : denyResponse(result.reason as never);
      }
      await auditAdminMutation(request, {
        actorId: guard.admin.id,
        action: nextRole ? "role.assign" : "admin_user.active.update",
        resourceType: "admin_user", resourceId: id,
        metadata: nextRole ? { from: target.role, to: nextRole, isActive } : { isActive },
      });
      return ok({ user: result.user });
    }

    return notFound();
    });
  } catch (error) {
    return fail("update admin user", error);
  }
}
