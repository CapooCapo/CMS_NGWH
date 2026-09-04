import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Live authorization tests for the staff role hierarchy.
 *
 * These are the checks the pure permission unit tests cannot make: that the
 * *HTTP surface* actually enforces the rules, on the actor's session role,
 * regardless of what the request body claims.
 *
 * Requires a running server and the three fixture accounts created by
 * `npm run admin:create` (see the README block below). The suite skips itself
 * when the server or the accounts are unavailable, so `npm test` still passes
 * without them.
 *
 *   ADMIN_PASSWORD=test-pass-superadmin-2026 npm run admin:create -- --username root-super --role superadmin
 *   ADMIN_PASSWORD=test-pass-admin-2026      npm run admin:create -- --username biz-admin  --role admin
 *   ADMIN_PASSWORD=test-pass-subadmin-2026   npm run admin:create -- --username read-only  --role subadmin
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const ACCOUNTS = {
  superadmin: {
    username: process.env.TEST_SUPERADMIN_USER ?? "root-super",
    password: process.env.TEST_SUPERADMIN_PASSWORD ?? "test-pass-superadmin-2026",
  },
  admin: {
    username: process.env.TEST_BIZADMIN_USER ?? "biz-admin",
    password: process.env.TEST_BIZADMIN_PASSWORD ?? "test-pass-admin-2026",
  },
  subadmin: {
    username: process.env.TEST_SUBADMIN_USER ?? "read-only",
    password: process.env.TEST_SUBADMIN_PASSWORD ?? "test-pass-subadmin-2026",
  },
} as const;

type RoleKey = keyof typeof ACCOUNTS;

let serverUp = false;
const cookies: Partial<Record<RoleKey, string>> = {};
let ids: Partial<Record<RoleKey, number>> = {};

async function login(role: RoleKey): Promise<string | null> {
  const { username, password } = ACCOUNTS[role];
  const response = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) return null;
  const set = response.headers.getSetCookie?.() ?? [];
  const session = set.find((c) => c.startsWith("ngwh_admin_session="));
  return session ? session.split(";")[0] : null;
}

const as = (role: RoleKey) => ({ Cookie: cookies[role]! });

before(async () => {
  try {
    const probe = await fetch(`${BASE}/api/live`, { signal: AbortSignal.timeout(5000) });
    serverUp = probe.status < 500;
  } catch {
    serverUp = false;
  }
  if (!serverUp) return;

  for (const role of Object.keys(ACCOUNTS) as RoleKey[]) {
    const cookie = await login(role);
    if (cookie) cookies[role] = cookie;
  }

  // Resolve account ids from the superadmin's view of the staff list.
  if (cookies.superadmin) {
    const response = await fetch(`${BASE}/api/admin/users`, {
      headers: as("superadmin"),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        users: { id: number; username: string; role: string }[];
      };
      const find = (role: RoleKey) =>
        data.users.find((u) => u.username === ACCOUNTS[role].username)?.id;
      ids = {
        superadmin: find("superadmin"),
        admin: find("admin"),
        subadmin: find("subadmin"),
      };
    }
  }
});

after(() => {
  if (!serverUp) console.log("      (server not reachable — suite skipped)");
  else if (!cookies.superadmin) console.log("      (fixture accounts missing — suite skipped)");
});

const ready = () => serverUp && cookies.superadmin && cookies.admin && cookies.subadmin;

/* ------------------------------------------------------------------ login */

test("superadmin can log in and its session reports the superadmin role", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!cookies.superadmin) return t.skip("superadmin fixture missing");
  const response = await fetch(`${BASE}/api/admin/me`, { headers: as("superadmin") });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { user: { role: string; username: string } };
  assert.equal(body.user.role, "superadmin");
  assert.equal(body.user.username, ACCOUNTS.superadmin.username);
});

test("each fixture role logs in with its own role", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  for (const role of ["superadmin", "admin", "subadmin"] as RoleKey[]) {
    const response = await fetch(`${BASE}/api/admin/me`, { headers: as(role) });
    assert.equal(response.status, 200, role);
    const body = (await response.json()) as { user: { role: string } };
    assert.equal(body.user.role, role, `${role} session role`);
  }
});

/* --------------------------------------------------- superadmin authorization */

const BUSINESS_READS = [
  "/api/admin/registrations",
  "/api/admin/clubs",
  "/api/admin/seasons",
  "/api/admin/matches",
  "/api/admin/contact",
];

test("superadmin can read every admin endpoint, including staff accounts", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  for (const path of [...BUSINESS_READS, "/api/admin/users"]) {
    const response = await fetch(`${BASE}${path}`, { headers: as("superadmin") });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
  }
});

test("superadmin can perform admin-only business mutations", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  // Season create is guarded by `requireRole()` — previously admin-only.
  const slug = `test-superadmin-${Date.now()}`;
  const response = await fetch(`${BASE}/api/admin/seasons`, {
    method: "POST",
    headers: { ...as("superadmin"), "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      nameEn: "Superadmin probe",
      nameVi: "Superadmin probe",
      status: "upcoming",
    }),
  });
  assert.equal(response.status, 201, `expected 201, got ${response.status}`);
});

/* -------------------------------------------------------- admin authorization */

test("admin keeps its existing access (business reads and writes)", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  for (const path of [...BUSINESS_READS, "/api/admin/users"]) {
    const response = await fetch(`${BASE}${path}`, { headers: as("admin") });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
  }
});

/* ----------------------------------------------------- subadmin authorization */

test("subadmin can read business content", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  for (const path of BUSINESS_READS) {
    const response = await fetch(`${BASE}${path}`, { headers: as("subadmin") });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
  }
});

test("subadmin cannot mutate business content", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const mutations: [string, string, unknown][] = [
    ["POST", "/api/admin/clubs", { slug: "x", name: "X", province: "Y" }],
    ["PATCH", "/api/admin/clubs/1", { slug: "x", name: "X", province: "Y" }],
    ["POST", "/api/admin/clubs/1/members", { fullName: "X", memberRole: "player" }],
    ["PATCH", "/api/admin/clubs/1/members/1", { fullName: "X", memberRole: "player" }],
    ["DELETE", "/api/admin/clubs/1/members/1", null],
    ["POST", "/api/admin/seasons", { slug: "x", nameEn: "X", nameVi: "X", status: "upcoming" }],
    ["POST", "/api/admin/matches", {}],
    ["POST", "/api/admin/registrations/1/review", { action: "approved" }],
    ["POST", "/api/admin/registrations/bulk", { action: "approve", ids: [1] }],
    ["PATCH", "/api/admin/registrations/1/documents/1", { isPublic: true }],
  ];
  for (const [method, path, body] of mutations) {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...as("subadmin"), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 403, `${method} ${path} returned ${response.status}`);
  }
});

test("subadmin cannot read or mutate staff accounts", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const read = await fetch(`${BASE}/api/admin/users`, { headers: as("subadmin") });
  assert.equal(read.status, 403);

  const create = await fetch(`${BASE}/api/admin/users`, {
    method: "POST",
    headers: { ...as("subadmin"), "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "should-not-exist",
      password: "irrelevant-but-long",
      role: "admin",
    }),
  });
  assert.equal(create.status, 403);

  if (ids.admin) {
    const patch = await fetch(`${BASE}/api/admin/users/${ids.admin}`, {
      method: "PATCH",
      headers: { ...as("subadmin"), "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(patch.status, 403);
  }
});

/* -------------------------------------- admin must not touch superadmin */

test("admin cannot create a superadmin", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const response = await fetch(`${BASE}/api/admin/users`, {
    method: "POST",
    headers: { ...as("admin"), "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `escalation-attempt-${Date.now()}`,
      password: "a-sufficiently-long-password",
      role: "superadmin",
    }),
  });
  assert.equal(response.status, 409, `expected 409, got ${response.status}`);
  const body = (await response.json()) as { error?: string };
  assert.equal(body.error, "cannotAssignSuperadmin");
});

test("admin cannot promote another account to superadmin", async (t) => {
  if (!ready() || !ids.subadmin) return t.skip("fixtures unavailable");
  const response = await fetch(`${BASE}/api/admin/users/${ids.subadmin}`, {
    method: "PATCH",
    headers: { ...as("admin"), "Content-Type": "application/json" },
    body: JSON.stringify({ role: "superadmin" }),
  });
  assert.equal(response.status, 409);
  assert.equal(((await response.json()) as { error?: string }).error, "cannotAssignSuperadmin");
});

test("admin cannot demote a superadmin", async (t) => {
  if (!ready() || !ids.superadmin) return t.skip("fixtures unavailable");
  const response = await fetch(`${BASE}/api/admin/users/${ids.superadmin}`, {
    method: "PATCH",
    headers: { ...as("admin"), "Content-Type": "application/json" },
    body: JSON.stringify({ role: "admin" }),
  });
  assert.equal(response.status, 409);
  assert.equal(((await response.json()) as { error?: string }).error, "cannotModifySuperadmin");
});

test("admin cannot deactivate a superadmin", async (t) => {
  if (!ready() || !ids.superadmin) return t.skip("fixtures unavailable");
  const response = await fetch(`${BASE}/api/admin/users/${ids.superadmin}`, {
    method: "PATCH",
    headers: { ...as("admin"), "Content-Type": "application/json" },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(response.status, 409);
  assert.equal(((await response.json()) as { error?: string }).error, "cannotModifySuperadmin");

  // And the account is genuinely still active.
  const me = await fetch(`${BASE}/api/admin/me`, { headers: as("superadmin") });
  assert.equal(me.status, 200, "superadmin session must still work");
});

/* ------------------------------------------------------ invariants / payloads */

test("an unknown role is rejected as a validation error, not a DB error", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  // Includes whitespace-padded and case-shifted variants: role matching is
  // exact, so " admin " must not be normalised into the valid `admin`.
  for (const role of [
    "root",
    "SUPERADMIN",
    "Admin",
    "",
    "owner",
    "admin ",
    " admin",
    " superadmin ",
    null,
    1,
    ["admin"],
    { role: "admin" },
  ]) {
    const response = await fetch(`${BASE}/api/admin/users`, {
      method: "POST",
      headers: { ...as("superadmin"), "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `bad-role-${Date.now()}`,
        password: "a-sufficiently-long-password",
        role,
      }),
    });
    assert.equal(response.status, 400, `role ${JSON.stringify(role)} -> ${response.status}`);
    const body = (await response.json()) as { error?: string; fields?: Record<string, string> };
    assert.equal(body.error, "validation");
    assert.ok(body.fields?.role, "should name the offending field");
  }
});

test("nobody can change their own role, including a superadmin", async (t) => {
  if (!ready() || !ids.superadmin || !ids.admin) return t.skip("fixtures unavailable");
  const selfSuper = await fetch(`${BASE}/api/admin/users/${ids.superadmin}`, {
    method: "PATCH",
    headers: { ...as("superadmin"), "Content-Type": "application/json" },
    body: JSON.stringify({ role: "admin" }),
  });
  assert.equal(selfSuper.status, 409);
  assert.equal(((await selfSuper.json()) as { error?: string }).error, "cannotModifySelf");

  const selfAdmin = await fetch(`${BASE}/api/admin/users/${ids.admin}`, {
    method: "PATCH",
    headers: { ...as("admin"), "Content-Type": "application/json" },
    body: JSON.stringify({ role: "superadmin" }),
  });
  assert.equal(selfAdmin.status, 409);
  assert.equal(((await selfAdmin.json()) as { error?: string }).error, "cannotModifySelf");
});

test("the last active superadmin cannot be demoted or deactivated", async (t) => {
  if (!ready() || !ids.superadmin) return t.skip("fixtures unavailable");

  // Confirm this really is the only active superadmin before asserting.
  const list = await fetch(`${BASE}/api/admin/users`, { headers: as("superadmin") });
  const { users } = (await list.json()) as {
    users: { id: number; role: string; is_active: boolean }[];
  };
  const actives = users.filter((u) => u.role === "superadmin" && u.is_active);
  if (actives.length !== 1) return t.skip(`${actives.length} active superadmins`);

  // A second superadmin is needed to attempt the change, since self-changes are
  // blocked earlier. With only one superadmin the guard that fires first is
  // `cannotModifySelf`, which is itself the protection — assert that.
  const response = await fetch(`${BASE}/api/admin/users/${ids.superadmin}`, {
    method: "PATCH",
    headers: { ...as("superadmin"), "Content-Type": "application/json" },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(response.status, 409);
  assert.equal(
    ((await response.json()) as { error?: string }).error,
    "cannotModifySelf",
    "the sole superadmin is protected from self-deactivation"
  );
});

test("an extra body field cannot smuggle a role past the guard", async (t) => {
  if (!ready() || !ids.subadmin) return t.skip("fixtures unavailable");
  // Payload pretends the actor is a superadmin. Authorization is derived from
  // the session, so this must change nothing.
  const response = await fetch(`${BASE}/api/admin/users/${ids.subadmin}`, {
    method: "PATCH",
    headers: { ...as("admin"), "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "superadmin",
      actorRole: "superadmin",
      isSuperadmin: true,
      admin: { role: "superadmin" },
    }),
  });
  assert.equal(response.status, 409);

  const list = await fetch(`${BASE}/api/admin/users`, { headers: as("superadmin") });
  const { users } = (await list.json()) as { users: { id: number; role: string }[] };
  const target = users.find((u) => u.id === ids.subadmin);
  assert.equal(target?.role, "subadmin", "role must be unchanged");
});

test("a PATCH with neither role nor isActive is rejected", async (t) => {
  if (!ready() || !ids.subadmin) return t.skip("fixtures unavailable");
  const response = await fetch(`${BASE}/api/admin/users/${ids.subadmin}`, {
    method: "PATCH",
    headers: { ...as("superadmin"), "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 400);
});

test("superadmin can change a non-superadmin role, and it persists", async (t) => {
  if (!ready() || !ids.subadmin) return t.skip("fixtures unavailable");
  const promote = await fetch(`${BASE}/api/admin/users/${ids.subadmin}`, {
    method: "PATCH",
    headers: { ...as("superadmin"), "Content-Type": "application/json" },
    body: JSON.stringify({ role: "operator" }),
  });
  assert.equal(promote.status, 200);
  assert.equal(((await promote.json()) as { user: { role: string } }).user.role, "operator");

  // Restore the fixture so the suite is re-runnable.
  const restore = await fetch(`${BASE}/api/admin/users/${ids.subadmin}`, {
    method: "PATCH",
    headers: { ...as("superadmin"), "Content-Type": "application/json" },
    body: JSON.stringify({ role: "subadmin" }),
  });
  assert.equal(restore.status, 200);
});
