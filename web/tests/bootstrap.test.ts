import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { query, pool } from "../src/server/db/pool";
import { verifyPassword } from "../src/server/auth/password";
import { isAdminRole } from "../src/server/auth/permissions";

/**
 * Bootstrap tests for `scripts/create-admin.mjs` — the project's account
 * seeding path (there is no runtime schema-init hook; migrations build the
 * schema and this script seeds the first account).
 *
 * The script is executed as a real child process so the test covers the actual
 * env-var contract an operator or CI job would use, not a re-implementation of
 * it. Every account it creates here is removed afterwards.
 */
const run = promisify(execFile);

const CREATED = [
  "test-bootstrap-super",
  "test-bootstrap-admin",
  "test-bootstrap-existing",
];

async function createAdmin(env: Record<string, string>, args: string[] = []) {
  return run("node", ["scripts/create-admin.mjs", ...args], {
    env: { ...process.env, ...env },
    cwd: process.cwd(),
  });
}

after(async () => {
  await query(
    `DELETE FROM admin_users WHERE username = ANY($1::text[])`,
    [CREATED]
  );
  await pool.end();
});

test("ADMIN_BOOTSTRAP creates a superadmin with a scrypt-hashed password", async () => {
  const username = "test-bootstrap-super";
  const password = "bootstrap-password-2026";

  const { stdout } = await createAdmin({
    ADMIN_BOOTSTRAP: username,
    ADMIN_BOOTSTRAP_PASSWORD: password,
    ADMIN_BOOTSTRAP_ROLE: "superadmin",
    ADMIN_BOOTSTRAP_EMAIL: "ops@example.test",
  });
  assert.match(stdout, /Staff account ready/);

  const rows = await query<{
    username: string;
    role: string;
    email: string | null;
    is_active: boolean;
    password_hash: string;
  }>(
    `SELECT username, role, email, is_active, password_hash
       FROM admin_users WHERE username = $1`,
    [username]
  );
  assert.equal(rows.length, 1, "account should exist");
  const user = rows[0];

  assert.equal(user.role, "superadmin");
  assert.ok(isAdminRole(user.role));
  assert.equal(user.email, "ops@example.test");
  assert.equal(user.is_active, true);

  // Stored as a scrypt hash, never the plaintext, and it verifies.
  assert.match(user.password_hash, /^scrypt\$\d+\$\d+\$\d+\$/);
  assert.ok(!user.password_hash.includes(password));
  assert.ok(await verifyPassword(password, user.password_hash));
  assert.ok(!(await verifyPassword("wrong-password-entirely", user.password_hash)));

  // The password must not be echoed anywhere in the output.
  assert.ok(!stdout.includes(password), "stdout must not leak the password");
});

test("ADMIN_BOOTSTRAP_ROLE defaults to admin when unset", async () => {
  const username = "test-bootstrap-admin";
  await createAdmin({
    ADMIN_BOOTSTRAP: username,
    ADMIN_BOOTSTRAP_PASSWORD: "bootstrap-password-2026",
    ADMIN_BOOTSTRAP_ROLE: "",
  });
  const rows = await query<{ role: string }>(
    "SELECT role FROM admin_users WHERE username = $1",
    [username]
  );
  assert.equal(rows[0]?.role, "admin");
});

test("an invalid bootstrap role is refused and creates nothing", async () => {
  const username = "test-bootstrap-invalid";
  await assert.rejects(
    () =>
      createAdmin({
        ADMIN_BOOTSTRAP: username,
        ADMIN_BOOTSTRAP_PASSWORD: "bootstrap-password-2026",
        ADMIN_BOOTSTRAP_ROLE: "root",
      }),
    (error: unknown) => {
      const e = error as { code?: number; stderr?: string };
      assert.equal(e.code, 1);
      assert.match(e.stderr ?? "", /Invalid role "root"/);
      return true;
    }
  );
  const rows = await query("SELECT 1 FROM admin_users WHERE username = $1", [
    username,
  ]);
  assert.equal(rows.length, 0, "no account should have been created");
});

test("a short bootstrap password is refused", async () => {
  await assert.rejects(
    () =>
      createAdmin({
        ADMIN_BOOTSTRAP: "test-bootstrap-short",
        ADMIN_BOOTSTRAP_PASSWORD: "short",
        ADMIN_BOOTSTRAP_ROLE: "superadmin",
      }),
    (error: unknown) => {
      const e = error as { code?: number; stderr?: string };
      assert.equal(e.code, 1);
      assert.match(e.stderr ?? "", /at least 10 characters/);
      return true;
    }
  );
});

test("unattended bootstrap is idempotent and never resets a live password", async () => {
  const username = "test-bootstrap-existing";
  const original = "original-password-2026";

  await createAdmin({
    ADMIN_BOOTSTRAP: username,
    ADMIN_BOOTSTRAP_PASSWORD: original,
    ADMIN_BOOTSTRAP_ROLE: "superadmin",
  });
  const before = await query<{ password_hash: string; role: string }>(
    "SELECT password_hash, role FROM admin_users WHERE username = $1",
    [username]
  );

  // Second unattended run with a different password: must leave it alone, so
  // re-running the bootstrap on every deploy cannot rotate a live credential.
  const { stdout } = await createAdmin({
    ADMIN_BOOTSTRAP: username,
    ADMIN_BOOTSTRAP_PASSWORD: "a-different-password-2026",
    ADMIN_BOOTSTRAP_ROLE: "admin",
  });
  assert.match(stdout, /already exists/);

  const afterRun = await query<{ password_hash: string; role: string }>(
    "SELECT password_hash, role FROM admin_users WHERE username = $1",
    [username]
  );
  assert.equal(afterRun[0].password_hash, before[0].password_hash, "hash unchanged");
  assert.equal(afterRun[0].role, "superadmin", "role unchanged");
  assert.ok(await verifyPassword(original, afterRun[0].password_hash));
});

test("an explicit --username run does reset the password (operator intent)", async () => {
  const username = "test-bootstrap-existing";
  const replacement = "explicitly-reset-2026";
  await createAdmin({ ADMIN_PASSWORD: replacement }, [
    "--username",
    username,
    "--role",
    "superadmin",
  ]);
  const rows = await query<{ password_hash: string }>(
    "SELECT password_hash FROM admin_users WHERE username = $1",
    [username]
  );
  assert.ok(await verifyPassword(replacement, rows[0].password_hash));
});

test("the database constraint rejects a role outside the known set", async () => {
  await assert.rejects(
    () =>
      query(
        `INSERT INTO admin_users (username, password_hash, role)
         VALUES ('test-bootstrap-constraint', 'x', 'root')`
      ),
    (error: unknown) => {
      // 23514 = check_violation. The CHECK is the backstop behind the
      // application-level role validation.
      assert.equal((error as { code?: string }).code, "23514");
      return true;
    }
  );
});
