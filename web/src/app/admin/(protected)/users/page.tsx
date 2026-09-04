import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, Card, ErrorState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import {
  countActiveSuperadmins,
  listAdminUsers,
} from "@/server/repositories/adminUsers";
import { currentAdmin } from "@/server/auth/session";
import {
  assignableRoles,
  canChangeRole,
  canDeactivate,
  canManageUsers,
} from "@/server/auth/permissions";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Staff accounts",
  robots: { index: false, follow: false },
};

/**
 * Staff account management — `admin` role only, re-checked here because a page
 * is a separate authorization surface from its API routes.
 *
 * There is deliberately no public counterpart: .ai/REQUIREMENTS.md states that
 * a general user-account system is not a requirement, so accounts exist purely
 * to make the BR-001 approval workflow actionable.
 */

/** Display names for the role badges and selectors. */
const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  editor: "Editor",
  operator: "Operator",
  subadmin: "Subadmin",
};

export default async function AdminUsersPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  if (!canManageUsers(admin.role)) {
    return (
      <>
        <AdminPageHeader title="Staff accounts" />
        <ErrorState
          title="Not permitted"
          body="Only an administrator can manage staff accounts."
        />
      </>
    );
  }

  let users;
  let activeSuperadmins = 0;
  try {
    [users, activeSuperadmins] = await Promise.all([
      listAdminUsers(),
      countActiveSuperadmins(),
    ]);
  } catch (error) {
    console.error("admin users", error);
    return (
      <>
        <AdminPageHeader title="Staff accounts" />
        <ErrorState title="Database unavailable" />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Staff accounts"
        description="Superadmin (system, manages superadmins) · admin (all business actions) · editor (content and review) · operator (scoreboard only) · subadmin (read-only)."
      />

      <div className="mb-6">
        <Disclosure label="Add a staff account">
          <JsonForm
            action="/api/admin/users"
            submitLabel="Create account"
            fields={[
              { name: "username", label: "Username", required: true },
              { name: "email", label: "Email", type: "email" },
              {
                name: "password",
                label: "Password",
                type: "password",
                required: true,
                hint: "At least 10 characters. Stored only as a scrypt hash.",
              },
              {
                name: "role",
                label: "Role",
                type: "select",
                required: true,
                defaultValue: "editor",
                /*
                 * Only the roles this actor may assign — an admin never sees
                 * "Superadmin" here. This is convenience, not protection:
                 * POST /api/admin/users re-checks against the session role, so
                 * hand-crafting the payload still gets 409.
                 */
                options: assignableRoles(admin.role).map((role) => ({
                  value: role,
                  label: ROLE_LABEL[role] ?? role,
                })),
              },
            ]}
          />
        </Disclosure>
      </div>

      <ul className="flex flex-col gap-3">
        {users.map((user) => {
          const isSelf = user.id === admin.id;
          const actor = { id: admin.id, role: admin.role };
          const target = { id: user.id, role: user.role };
          // The same predicates the API enforces, used here to decide what to
          // render. Server-side authorization remains authoritative.
          const deactivation = canDeactivate(actor, target);
          const roleEditable = assignableRoles(admin.role).some(
            (role) =>
              role !== user.role &&
              canChangeRole(actor, target, role, activeSuperadmins).allowed
          );

          return (
            <li key={user.id}>
              <Card
                className={`flex flex-wrap items-center justify-between gap-3 p-4 ${
                  user.role === "superadmin" ? "border-accent-strong/45" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{user.username}</h2>
                    <Badge tone={user.role === "superadmin" ? "brand" : "neutral"}>
                      {ROLE_LABEL[user.role] ?? user.role}
                    </Badge>
                    <Badge tone={user.is_active ? "success" : "muted"}>
                      {user.is_active ? "Active" : "Disabled"}
                    </Badge>
                    {isSelf && <Badge tone="accent">You</Badge>}
                  </div>
                  <p className="mt-0.5 text-[length:var(--text-sm)] text-muted">
                    {user.email ?? "no email"} ·{" "}
                    {user.last_login_at
                      ? `last signed in ${formatDateTime(user.last_login_at, "en")}`
                      : "never signed in"}
                  </p>
                  {!deactivation.allowed && !isSelf && (
                    <p className="mt-1.5 text-[length:var(--text-xs)] text-muted">
                      {deactivation.reason === "cannotModifySuperadmin"
                        ? "Only a superadmin can modify a superadmin account."
                        : deactivation.reason === "lastSuperadmin"
                          ? "This is the last active superadmin."
                          : "Your role cannot modify this account."}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {roleEditable && !isSelf && (
                    <RoleSelect
                      userId={user.id}
                      currentRole={user.role}
                      options={assignableRoles(admin.role)
                        .filter((role) =>
                          canChangeRole(actor, target, role, activeSuperadmins).allowed
                        )
                        .map((role) => ({
                          value: role,
                          label: ROLE_LABEL[role] ?? role,
                        }))}
                    />
                  )}
                  {deactivation.allowed && (
                    <ToggleButton
                      action={`/api/admin/users/${user.id}`}
                      method="PATCH"
                      body={{ isActive: !user.is_active }}
                      label={user.is_active ? "Disable" : "Enable"}
                      tone={user.is_active ? "outline" : "primary"}
                      confirm={
                        user.is_active
                          ? "Disable this account? Their sessions stop working immediately."
                          : undefined
                      }
                    />
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
