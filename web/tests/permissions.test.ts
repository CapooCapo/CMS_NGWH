import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_ROLES,
  assignableRoles,
  canAssignRole,
  canChangeRole,
  canCreateUser,
  canDeactivate,
  canManageUsers,
  canModifyUser,
  isAdminRole,
  isPrivileged,
  isReadOnly,
  isSuperadmin,
  type AdminRole,
} from "../src/server/auth/permissions";

const SUPER = { id: 1, role: "superadmin" as AdminRole };
const ADMIN = { id: 2, role: "admin" as AdminRole };
const ADMIN2 = { id: 3, role: "admin" as AdminRole };
const EDITOR = { id: 4, role: "editor" as AdminRole };
const OPERATOR = { id: 5, role: "operator" as AdminRole };
const SUBADMIN = { id: 6, role: "subadmin" as AdminRole };
const SUPER2 = { id: 7, role: "superadmin" as AdminRole };

test("the role set is exactly the documented hierarchy", () => {
  assert.deepEqual([...ADMIN_ROLES], [
    "superadmin",
    "admin",
    "editor",
    "operator",
    "subadmin",
  ]);
});

test("isAdminRole rejects anything outside the set", () => {
  for (const role of ADMIN_ROLES) assert.ok(isAdminRole(role));
  for (const bad of [
    "root",
    "SUPERADMIN",
    "super admin",
    "",
    " admin",
    null,
    undefined,
    0,
    {},
    ["admin"],
  ]) {
    assert.equal(isAdminRole(bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});

test("privileged roles are exactly superadmin and admin", () => {
  assert.ok(isPrivileged("superadmin"));
  assert.ok(isPrivileged("admin"));
  for (const role of ["editor", "operator", "subadmin"] as AdminRole[]) {
    assert.equal(isPrivileged(role), false, role);
  }
});

test("superadmin and read-only predicates are precise", () => {
  assert.ok(isSuperadmin("superadmin"));
  assert.equal(isSuperadmin("admin"), false);
  assert.ok(isReadOnly("subadmin"));
  for (const role of ["superadmin", "admin", "editor", "operator"] as AdminRole[]) {
    assert.equal(isReadOnly(role), false, role);
  }
});

/* ------------------------------------------------ who may manage accounts */

test("only superadmin and admin may manage staff accounts", () => {
  assert.ok(canManageUsers("superadmin"));
  assert.ok(canManageUsers("admin"));
  for (const role of ["editor", "operator", "subadmin"] as AdminRole[]) {
    assert.equal(canManageUsers(role), false, role);
  }
});

test("only a superadmin may assign the superadmin role", () => {
  assert.ok(canAssignRole("superadmin", "superadmin"));
  assert.equal(canAssignRole("admin", "superadmin"), false);
  // Admin can still assign every non-superadmin role, as before.
  for (const role of ["admin", "editor", "operator", "subadmin"] as AdminRole[]) {
    assert.ok(canAssignRole("admin", role), `admin -> ${role}`);
    assert.ok(canAssignRole("superadmin", role), `superadmin -> ${role}`);
  }
  // Non-managers can assign nothing at all.
  for (const actor of ["editor", "operator", "subadmin"] as AdminRole[]) {
    for (const role of ADMIN_ROLES) {
      assert.equal(canAssignRole(actor, role), false, `${actor} -> ${role}`);
    }
  }
});

test("assignableRoles omits superadmin for an admin", () => {
  assert.deepEqual(assignableRoles("superadmin"), [...ADMIN_ROLES]);
  assert.deepEqual(assignableRoles("admin"), [
    "admin",
    "editor",
    "operator",
    "subadmin",
  ]);
  assert.deepEqual(assignableRoles("editor"), []);
  assert.deepEqual(assignableRoles("subadmin"), []);
});

test("nobody may act on an account that outranks them", () => {
  assert.equal(canModifyUser("admin", "superadmin"), false);
  assert.ok(canModifyUser("superadmin", "admin"));
  assert.ok(canModifyUser("superadmin", "superadmin"));
  // Equal rank is allowed, preserving admin-manages-admin behaviour.
  assert.ok(canModifyUser("admin", "admin"));
  assert.ok(canModifyUser("admin", "editor"));
});

/* ---------------------------------------------------------- deactivation */

test("admin cannot deactivate a superadmin", () => {
  const d = canDeactivate(ADMIN, SUPER);
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.reason, "cannotModifySuperadmin");
});

test("superadmin can deactivate an admin", () => {
  assert.ok(canDeactivate(SUPER, ADMIN).allowed);
});

test("nobody may deactivate their own account", () => {
  for (const actor of [SUPER, ADMIN]) {
    const d = canDeactivate(actor, actor);
    assert.equal(d.allowed, false);
    assert.equal(d.allowed === false && d.reason, "cannotModifySelf");
  }
});

test("non-managers may not deactivate anyone", () => {
  for (const actor of [EDITOR, OPERATOR, SUBADMIN]) {
    const d = canDeactivate(actor, ADMIN);
    assert.equal(d.allowed, false, actor.role);
    assert.equal(d.allowed === false && d.reason, "forbidden");
  }
});

/* --------------------------------------------------------- role changes */

test("admin cannot promote anyone to superadmin", () => {
  const d = canChangeRole(ADMIN, EDITOR, "superadmin", 1);
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.reason, "cannotAssignSuperadmin");
});

test("admin cannot demote a superadmin", () => {
  const d = canChangeRole(ADMIN, SUPER, "admin", 2);
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.reason, "cannotModifySuperadmin");
});

test("superadmin can promote and demote, and can manage another admin", () => {
  assert.ok(canChangeRole(SUPER, EDITOR, "superadmin", 1).allowed);
  assert.ok(canChangeRole(SUPER, SUPER2, "admin", 2).allowed);
  assert.ok(canChangeRole(SUPER, ADMIN, "subadmin", 1).allowed);
  assert.ok(canChangeRole(ADMIN, ADMIN2, "editor", 1).allowed);
});

test("the last active superadmin cannot be demoted", () => {
  const d = canChangeRole(SUPER, SUPER2, "admin", 1);
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.reason, "lastSuperadmin");
  // With two active superadmins the same change is fine.
  assert.ok(canChangeRole(SUPER, SUPER2, "admin", 2).allowed);
  // Re-assigning superadmin to a superadmin is a no-op, never blocked.
  assert.ok(canChangeRole(SUPER, SUPER2, "superadmin", 1).allowed);
});

test("non-managers may not change any role", () => {
  for (const actor of [EDITOR, OPERATOR, SUBADMIN]) {
    const d = canChangeRole(actor, SUBADMIN, "admin", 2);
    assert.equal(d.allowed, false, actor.role);
    assert.equal(d.allowed === false && d.reason, "forbidden");
  }
});

/* -------------------------------------------------------- account creation */

test("canCreateUser mirrors the assignment rules", () => {
  assert.ok(canCreateUser("superadmin", "superadmin").allowed);
  const denied = canCreateUser("admin", "superadmin");
  assert.equal(denied.allowed, false);
  assert.equal(denied.allowed === false && denied.reason, "cannotAssignSuperadmin");
  assert.ok(canCreateUser("admin", "editor").allowed);
  assert.ok(canCreateUser("admin", "subadmin").allowed);
  for (const actor of ["editor", "operator", "subadmin"] as AdminRole[]) {
    const d = canCreateUser(actor, "editor");
    assert.equal(d.allowed, false, actor);
    assert.equal(d.allowed === false && d.reason, "forbidden");
  }
});

test("no escalation path exists from admin to superadmin", () => {
  // Exhaustive: for every target account and every requested role, an admin
  // must never end up granting superadmin.
  const targets = [SUPER, ADMIN, ADMIN2, EDITOR, OPERATOR, SUBADMIN];
  for (const target of targets) {
    for (const role of ADMIN_ROLES) {
      for (const count of [1, 2, 5]) {
        const decision = canChangeRole(ADMIN, target, role, count);
        if (decision.allowed) {
          assert.notEqual(
            role,
            "superadmin",
            `admin must never assign superadmin (target ${target.role})`
          );
          assert.notEqual(
            target.role,
            "superadmin",
            `admin must never modify a superadmin (role ${role})`
          );
        }
      }
    }
    assert.equal(canCreateUser(ADMIN.role, "superadmin").allowed, false);
  }
});
