import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import {
  countActiveSuperadmins,
  listAdminUsersPage,
} from "@/server/repositories/adminUsers";
import { currentAdmin } from "@/server/auth/session";
import {
  assignableRoles,
  canChangeRole,
  canDeactivate,
  canManageUsers,
} from "@/server/auth/permissions";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const [metaT, t] = await Promise.all([
    getTranslations("admin.meta"),
    getTranslations("admin.users"),
  ]);
  return {
    title: metaT("users"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

/**
 * Staff account management — `admin` role only, re-checked here because a page
 * is a separate authorization surface from its API routes.
 *
 * There is deliberately no public counterpart: .ai/REQUIREMENTS.md states that
 * a general user-account system is not a requirement, so accounts exist purely
 * to make the BR-001 approval workflow actionable.
 */

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const [t, roleT, statusT, actionsT, locale] = await Promise.all([
    getTranslations("admin.users"),
    getTranslations("admin.roles"),
    getTranslations("admin.status"),
    getTranslations("admin.actions"),
    getLocale(),
  ]);
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  if (!canManageUsers(admin.role)) {
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState
          title={t("notPermitted")}
          body={t("notPermittedBody")}
        />
      </>
    );
  }
  const params = await searchParams;
  const page = parsePage(params.page);

  let users;
  let activeSuperadmins = 0;
  try {
    [users, activeSuperadmins] = await Promise.all([
      listAdminUsersPage(page),
      countActiveSuperadmins(),
    ]);
  } catch (error) {
    console.error("admin users", error);
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState title={t("databaseUnavailable")} />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
      />

      <div className="mb-6">
        <Disclosure label={t("add")}>
          <JsonForm
            action="/api/admin/users"
            submitLabel={t("create")}
            fields={[
              { name: "username", label: t("username"), required: true },
              { name: "email", label: t("email"), type: "email" },
              {
                name: "password",
                label: t("password"),
                type: "password",
                required: true,
                hint: t("passwordHint"),
              },
              {
                name: "role",
                label: t("role"),
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
                  label: roleT(role),
                })),
              },
            ]}
          />
        </Disclosure>
      </div>

      {users.rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <>
          <Table
            caption={t("tableCaption")}
            minWidth="52rem"
            head={<><Th sticky>{t("account")}</Th><Th>{t("role")}</Th><Th>{t("status")}</Th><Th>{t("lastLogin")}</Th><Th align="right">{t("actions")}</Th></>}
          >
        {users.rows.map((user) => {
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
            <tr key={user.id} className={user.role === "superadmin" ? "bg-accent/5 hover:bg-surface-sunken" : "hover:bg-surface-sunken"}>
              <Td header sticky>
                <span className="block">{user.username} {isSelf && <Badge tone="accent">{t("you")}</Badge>}</span>
                <span className="block text-[length:var(--text-xs)] font-normal text-muted">{user.email ?? t("noEmail")}</span>
              </Td>
              <Td><Badge tone={user.role === "superadmin" ? "brand" : "neutral"}>{roleT(user.role)}</Badge></Td>
              <Td><Badge tone={user.is_active ? "success" : "muted"}>{user.is_active ? statusT("active") : statusT("disabled")}</Badge></Td>
              <Td className="whitespace-nowrap text-muted">{user.last_login_at ? formatDateTime(user.last_login_at, locale) ?? "—" : t("neverSignedIn")}</Td>
              <Td align="right">
                <div className="flex flex-wrap justify-end gap-2">
                  {roleEditable && !isSelf && (
                    <RoleSelect userId={user.id} currentRole={user.role} currentRoleLabel={roleT(user.role)} options={assignableRoles(admin.role)
                      .filter((role) => canChangeRole(actor, target, role, activeSuperadmins).allowed)
                      .map((role) => ({ value: role, label: roleT(role) }))} />
                  )}
                  {deactivation.allowed && (
                    <ToggleButton action={`/api/admin/users/${user.id}`} method="PATCH" body={{ isActive: !user.is_active }} label={user.is_active ? actionsT("disable") : actionsT("enable")} tone={user.is_active ? "outline" : "primary"} confirm={user.is_active ? t("disableConfirm") : undefined} />
                  )}
                </div>
                {!deactivation.allowed && !isSelf && (
                  <span className="mt-1 block text-[length:var(--text-xs)] text-muted">
                    {deactivation.reason === "cannotModifySuperadmin" ? t("cannotModifySuperadmin") : deactivation.reason === "lastSuperadmin" ? t("lastSuperadmin") : t("cannotModify")}
                  </span>
                )}
              </Td>
            </tr>
          );
        })}
          </Table>
          <AdminPagination basePath="/admin/users" pagination={users} searchParams={{}} />
        </>
      )}
    </>
  );
}
