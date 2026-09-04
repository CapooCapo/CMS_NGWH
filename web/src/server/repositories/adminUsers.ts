import "server-only";
import { query, queryOne, transaction } from "@/server/db/pool";
import type { AdminRole } from "@/server/auth/permissions";

export type AdminUser = {
  id: number;
  username: string;
  email: string | null;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
};

const COLUMNS = `id, username, email, role, is_active,
  to_char(last_login_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS last_login_at`;

/** Includes the hash — only the login route may use this. */
export function findByUsernameWithHash(username: string): Promise<
  (AdminUser & { password_hash: string }) | null
> {
  return queryOne<AdminUser & { password_hash: string }>(
    `SELECT ${COLUMNS}, password_hash FROM admin_users
      WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
}

/** Staff accounts, highest role first so the hierarchy reads at a glance. */
export function listAdminUsers(): Promise<AdminUser[]> {
  return query<AdminUser>(
    `SELECT ${COLUMNS} FROM admin_users
      ORDER BY CASE role
                 WHEN 'superadmin' THEN 0
                 WHEN 'admin' THEN 1
                 WHEN 'editor' THEN 2
                 WHEN 'operator' THEN 3
                 ELSE 4
               END, username`
  );
}

export function createAdminUser(input: {
  username: string;
  email: string | null;
  passwordHash: string;
  role: AdminRole;
}): Promise<AdminUser | null> {
  return queryOne<AdminUser>(
    `INSERT INTO admin_users (username, email, password_hash, role)
     VALUES ($1,$2,$3,$4) RETURNING ${COLUMNS}`,
    [input.username, input.email, input.passwordHash, input.role]
  );
}

/**
 * Activates or deactivates an account under the last-superadmin invariant.
 *
 * Deactivating the last active superadmin is refused for the same reason
 * demoting them is: it would leave nobody able to manage superadmins. Read and
 * write share one transaction with the row locked so the check cannot be raced.
 */
export async function setAdminUserActive(
  id: number,
  isActive: boolean,
  decide: (
    target: { id: number; role: AdminRole },
    activeSuperadmins: number
  ) => string | null
): Promise<
  { ok: true; user: AdminUser } | { ok: false; reason: string | "notFound" }
> {
  return transaction(async (client) => {
    const { rows: found } = await client.query<{ id: number; role: AdminRole }>(
      "SELECT id, role FROM admin_users WHERE id = $1 FOR UPDATE",
      [id]
    );
    const target = found[0];
    if (!target) return { ok: false as const, reason: "notFound" };

    const { rows: counted } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM admin_users
        WHERE role = 'superadmin' AND is_active = TRUE`
    );
    const activeSuperadmins = Number(counted[0]?.count ?? 0);

    const refusal = decide(target, activeSuperadmins);
    if (refusal) return { ok: false as const, reason: refusal };

    const { rows: updated } = await client.query<AdminUser>(
      `UPDATE admin_users SET is_active = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, isActive]
    );
    return { ok: true as const, user: updated[0] };
  });
}

export async function recordLogin(id: number): Promise<void> {
  await query("UPDATE admin_users SET last_login_at = now() WHERE id = $1", [id]);
}

export async function countAdminUsers(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM admin_users"
  );
  return Number(row?.count ?? 0);
}

/** Active superadmins. Used for the last-superadmin invariant. */
export async function countActiveSuperadmins(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM admin_users
      WHERE role = 'superadmin' AND is_active = TRUE`
  );
  return Number(row?.count ?? 0);
}

export function findAdminUserById(id: number): Promise<AdminUser | null> {
  return queryOne<AdminUser>(`SELECT ${COLUMNS} FROM admin_users WHERE id = $1`, [
    id,
  ]);
}

/**
 * Changes a role under the last-superadmin invariant.
 *
 * The count and the update happen in one transaction with the target row
 * locked (`FOR UPDATE`), so two concurrent requests cannot each observe two
 * superadmins and then both demote one. `decide` receives the freshly-read
 * target and the in-transaction count and returns null to allow or a reason to
 * refuse — the policy itself stays in `@/server/auth/permissions`.
 */
export async function changeAdminUserRole(
  id: number,
  nextRole: AdminRole,
  decide: (
    target: { id: number; role: AdminRole },
    activeSuperadmins: number
  ) => string | null
): Promise<
  { ok: true; user: AdminUser } | { ok: false; reason: string | "notFound" }
> {
  return transaction(async (client) => {
    const { rows: found } = await client.query<{ id: number; role: AdminRole }>(
      "SELECT id, role FROM admin_users WHERE id = $1 FOR UPDATE",
      [id]
    );
    const target = found[0];
    if (!target) return { ok: false as const, reason: "notFound" };

    const { rows: counted } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM admin_users
        WHERE role = 'superadmin' AND is_active = TRUE`
    );
    const activeSuperadmins = Number(counted[0]?.count ?? 0);

    const refusal = decide(target, activeSuperadmins);
    if (refusal) return { ok: false as const, reason: refusal };

    const { rows: updated } = await client.query<AdminUser>(
      `UPDATE admin_users SET role = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, nextRole]
    );
    return { ok: true as const, user: updated[0] };
  });
}
