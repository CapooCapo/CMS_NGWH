import { requireUserAdmin } from "@/server/auth/guard";
import { denyResponse } from "@/server/auth/guard";
import {
  canCreateUser,
  isAdminRole,
  type AdminRole,
} from "@/server/auth/permissions";
import {
  createAdminUser,
  listAdminUsers,
} from "@/server/repositories/adminUsers";
import { hashPassword } from "@/server/auth/password";
import { fail, ok } from "@/server/api/respond";
import { Validator, readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

/**
 * Staff account management.
 *
 * Not a public registration endpoint: .ai/REQUIREMENTS.md has no user-account
 * requirement, so accounts exist only to make the BR-001 approval workflow
 * actionable and can only be created by an existing admin/superadmin (or the
 * CLI bootstrap).
 *
 * The role hierarchy is enforced here, server-side, on the *actor's session
 * role* — never on anything the client sent. A caller who edits the request
 * payload to `{"role":"superadmin"}` is refused unless their own session is
 * already a superadmin.
 */
export async function GET() {
  const guard = await requireUserAdmin();
  if (!guard.ok) return guard.response;
  try {
    return ok({
      users: await listAdminUsers(),
      // The actor's own role, so the UI can render the right controls. It is
      // advisory only: every mutation re-derives it from the session.
      actor: { id: guard.admin.id, role: guard.admin.role },
    });
  } catch (error) {
    return fail("list admin users", error);
  }
}

export async function POST(request: Request) {
  const guard = await requireUserAdmin();
  if (!guard.ok) return guard.response;
  try {
    const body = await readJson(request);
    const v = new Validator(body);
    v.only(["username", "email", "password", "role"]);
    const username = v.string("username", { required: true, min: 3, max: 64 }) ?? "";
    const email = v.email("email");
    // 10 chars minimum, matching the CLI bootstrap script.
    const password = v.string("password", { required: true, min: 10, max: 200 }) ?? "";
    /*
     * Role is matched exactly against the known set — no trimming, no case
     * folding. The shared `Validator.enum` trims first, which would quietly
     * accept `"admin "`; for a value that drives both an authorization
     * decision and a database CHECK constraint, the contract should be exact.
     */
    if (!isAdminRole(body.role)) v.errors.role ??= "invalidChoice";
    // Throws unless every field passed, so the cast below is sound: control
    // only reaches it when `isAdminRole` returned true.
    v.assert();
    const role = body.role as AdminRole;

    // Authorization on the requested role, decided from the session role —
    // never from anything else the client sent.
    const decision = canCreateUser(guard.admin.role, role);
    if (!decision.allowed) return denyResponse(decision.reason);

    const passwordHash = await hashPassword(password);
    const user = await auditedAdminMutation(
      request,
      (created) => ({
        actorId: guard.admin.id, action: "admin_user.create", resourceType: "admin_user",
        resourceId: created?.id ?? "new", metadata: { role: created?.role ?? role },
      }),
      () => createAdminUser({ username, email, passwordHash, role }),
      Boolean
    );
    if (!user) throw new Error("admin user creation returned no record");
    // The hash is never returned.
    return ok({ user }, 201);
  } catch (error) {
    return fail("create admin user", error);
  }
}
