import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { query, pool } from "../src/server/db/pool";

/**
 * Authorization and validation tests against a running dev server.
 *
 * These are the checks that unit tests cannot make: that every admin endpoint
 * actually refuses an unauthenticated caller, that a session cookie unlocks
 * them, and that the public write endpoints validate their input.
 *
 * Set BASE_URL to point at a running server (default http://localhost:3000).
 * The suite skips itself if the server is not reachable, so `npm test` still
 * passes without one.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const USER = process.env.TEST_ADMIN_USERNAME ?? "admin";
const PASS = process.env.TEST_ADMIN_PASSWORD ?? "";
const SETUP_IP = "198.51.100.201";
const WRONG_PASSWORD_IP = "198.51.100.202";
const UNKNOWN_USER_IP = "198.51.100.203";
const UNKNOWN_USER = "api-authorization-unknown-user";

let serverUp = false;
let cookie: string | null = null;
let authSetupStatus: number | null = null;
let authSetupError: string | null = null;

function loginHeaders(ip: string) {
  return {
    "Content-Type": "application/json",
    "X-Forwarded-For": ip,
  };
}

function suiteRateLimitKeys() {
  const secret = process.env.LOGIN_RATE_LIMIT_SECRET;
  if (!secret?.trim()) return [];
  const hash = (scope: "account" | "ip", value: string) =>
    `login-limit:${scope}:${createHmac("sha256", secret)
      .update(scope === "account" ? value.trim().toLowerCase() : value)
      .digest("base64url")}`;
  return [
    hash("account", USER),
    hash("account", UNKNOWN_USER),
    hash("ip", SETUP_IP),
    hash("ip", WRONG_PASSWORD_IP),
    hash("ip", UNKNOWN_USER_IP),
  ];
}

async function clearSuiteRateLimits() {
  const keys = suiteRateLimitKeys();
  if (keys.length) {
    await query("DELETE FROM login_rate_limits WHERE key_hash = ANY($1::text[])", [keys]);
  }
}

before(async () => {
  try {
    const response = await fetch(`${BASE}/api/live`, {
      signal: AbortSignal.timeout(5000),
    });
    serverUp = response.status < 500;
  } catch {
    serverUp = false;
  }
  if (!serverUp) return;

  if (PASS) {
    await clearSuiteRateLimits();
    const response = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: loginHeaders(SETUP_IP),
      body: JSON.stringify({ username: USER, password: PASS }),
    });
    authSetupStatus = response.status;
    const setCookie = response.headers.getSetCookie?.() ?? [];
    const session = setCookie.find((c) => c.startsWith("ngwh_admin_session="));
    if (response.ok && session) cookie = session.split(";")[0];
    else {
      authSetupError = `login setup returned ${response.status} without an ngwh_admin_session cookie`;
    }
  }
});

after(async () => {
  try {
    if (!serverUp) {
      console.log("      (server not reachable — API tests were skipped)");
    } else if (!PASS) {
      console.log("      (TEST_ADMIN_PASSWORD is not configured — authenticated cases were skipped)");
    } else if (!cookie) {
      console.log(`      (authentication setup failed: ${authSetupError ?? "no session cookie returned"})`);
    }
  } finally {
    if (serverUp && suiteRateLimitKeys().length) {
      await clearSuiteRateLimits();
      await pool.end();
    }
  }
});

/** Every admin endpoint, with the method that mutates or reads it. */
const ADMIN_ENDPOINTS: [string, string][] = [
  ["GET", "/api/admin/me"],
  ["GET", "/api/admin/audit-logs"],
  ["GET", "/api/admin/registrations"],
  ["POST", "/api/admin/registrations/1/review"],
  ["GET", "/api/admin/registrations/1/documents/1"],
  ["PATCH", "/api/admin/registrations/1/documents/1"],
  ["POST", "/api/admin/registrations/bulk"],
  ["POST", "/api/admin/translate"],
  ["GET", "/api/admin/clubs"],
  ["POST", "/api/admin/clubs"],
  ["GET", "/api/admin/clubs/1"],
  ["PATCH", "/api/admin/clubs/1"],
  ["DELETE", "/api/admin/clubs/1"],
  ["POST", "/api/admin/clubs/1/approval"],
  ["POST", "/api/admin/clubs/1/owner"],
  ["DELETE", "/api/admin/clubs/1/owner"],
  ["GET", "/api/admin/clubs/1/members"],
  ["POST", "/api/admin/clubs/1/members"],
  ["PATCH", "/api/admin/clubs/1/members/1"],
  ["DELETE", "/api/admin/clubs/1/members/1"],
  ["GET", "/api/admin/seasons"],
  ["POST", "/api/admin/seasons"],
  ["PATCH", "/api/admin/seasons/1"],
  ["GET", "/api/admin/matches"],
  ["POST", "/api/admin/matches"],
  ["GET", "/api/admin/matches/1"],
  ["PATCH", "/api/admin/matches/1"],
  ["DELETE", "/api/admin/matches/1"],
  ["POST", "/api/admin/matches/1/score"],
  ["GET", "/api/admin/matches/1/stats"],
  ["POST", "/api/admin/matches/1/stats"],
  ["DELETE", "/api/admin/matches/1/stats/1"],
  ["GET", "/api/admin/contact"],
  ["PATCH", "/api/admin/contact/1"],
  ["GET", "/api/admin/users"],
  ["POST", "/api/admin/users"],
  ["PATCH", "/api/admin/users/1"],
];

test("every admin API endpoint rejects an unauthenticated caller with 401", async (t) => {
  if (!serverUp) return t.skip("server not running");
  for (const [method, path] of ADMIN_ENDPOINTS) {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : "{}",
    });
    assert.equal(
      response.status,
      401,
      `${method} ${path} returned ${response.status}, expected 401`
    );
  }
});

test("a forged session cookie is rejected", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const response = await fetch(`${BASE}/api/admin/me`, {
    headers: { Cookie: "ngwh_admin_session=not-a-real-token" },
  });
  assert.equal(response.status, 401);
});

test("admin page routes redirect an unauthenticated visitor to the login page", async (t) => {
  if (!serverUp) return t.skip("server not running");
  for (const path of [
    "/admin",
    "/admin/dashboard",
    "/admin/registrations",
    "/admin/clubs",
    "/admin/seasons",
    "/admin/matches",
    "/admin/contact",
    "/admin/users",
  ]) {
    const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
    assert.ok(
      response.status === 307 || response.status === 302 || response.status === 308,
      `${path} returned ${response.status}, expected a redirect`
    );
    const location = response.headers.get("location") ?? "";
    assert.ok(
      location.includes("/admin/login"),
      `${path} redirected to ${location}, expected /admin/login`
    );
  }
});

test("login rejects wrong credentials with 401 and sets no cookie", async (t) => {
  if (!serverUp) return t.skip("server not running");
  await clearSuiteRateLimits();
  const response = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: loginHeaders(WRONG_PASSWORD_IP),
    body: JSON.stringify({ username: USER, password: "definitely-wrong" }),
  });
  // PostgreSQL-backed limiter tests run independently. The optional running
  // server may lack the limiter migration or HMAC configuration.
  if (response.status === 503) return t.skip("running server has no rate-limit store configured");
  assert.equal(response.status, 401);
  const setCookie = response.headers.getSetCookie?.() ?? [];
  assert.ok(!setCookie.some((c) => c.startsWith("ngwh_admin_session=")));
});

test("login does not distinguish an unknown user from a wrong password", async (t) => {
  if (!serverUp) return t.skip("server not running");
  await clearSuiteRateLimits();
  const unknown = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: loginHeaders(UNKNOWN_USER_IP),
    body: JSON.stringify({ username: UNKNOWN_USER, password: "whatever123" }),
  });
  const wrong = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: loginHeaders(WRONG_PASSWORD_IP),
    body: JSON.stringify({ username: USER, password: "whatever123" }),
  });
  if (unknown.status === 503 && wrong.status === 503) {
    return t.skip("running server has no rate-limit store configured");
  }
  assert.equal(unknown.status, wrong.status);
  assert.deepEqual(await unknown.json(), await wrong.json());
});

test("an authenticated session can read admin endpoints", async (t) => {
  if (!serverUp) return t.skip("server not running");
  // Copied to a const so TypeScript narrows it: `cookie` is a mutable
  // module-level binding, so the guard above does not narrow it on its own.
  const sessionCookie = cookie;
  if (!PASS) return t.skip("TEST_ADMIN_PASSWORD is not configured");
  assert.equal(authSetupStatus, 200, authSetupError ?? "authentication setup failed");
  assert.ok(sessionCookie, authSetupError ?? "authentication setup did not return a session cookie");
  for (const path of [
    "/api/admin/me",
    "/api/admin/audit-logs",
    "/api/admin/registrations",
    "/api/admin/clubs",
    "/api/admin/seasons",
    "/api/admin/matches",
    "/api/admin/contact",
    "/api/admin/users",
  ]) {
    const response: Response = await fetch(`${BASE}${path}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
  }
});

test("audit history is read-only and rejects unsafe pagination filters", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const sessionCookie = cookie;
  if (!PASS) return t.skip("TEST_ADMIN_PASSWORD is not configured");
  assert.equal(authSetupStatus, 200, authSetupError ?? "authentication setup failed");
  assert.ok(sessionCookie, authSetupError ?? "authentication setup did not return a session cookie");

  const limited = await fetch(`${BASE}/api/admin/audit-logs?limit=1`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(limited.status, 200);
  const body = (await limited.json()) as {
    items: { createdAt: string }[];
    pagination: { limit: number };
  };
  assert.ok(body.items.length <= 1);
  assert.equal(body.pagination.limit, 1);
  for (const item of body.items) {
    assert.match(item.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(!Number.isNaN(new Date(item.createdAt).getTime()));
  }

  const invalid = await fetch(`${BASE}/api/admin/audit-logs?limit=51`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {
    error: { code: "INVALID_INPUT", message: "Invalid request" },
  });

  const write = await fetch(`${BASE}/api/admin/audit-logs`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  assert.equal(write.status, 405);
});

test("public contact endpoint validates its input", async (t) => {
  if (!serverUp) return t.skip("server not running");

  const empty = await fetch(`${BASE}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(empty.status, 400);
  const body = (await empty.json()) as { fields?: Record<string, string> };
  assert.equal(body.fields?.name, "required");
  assert.equal(body.fields?.email, "required");
  assert.equal(body.fields?.message, "required");

  const badEmail = await fetch(`${BASE}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Tester",
      email: "not-an-email",
      message: "This is a long enough message.",
    }),
  });
  assert.equal(badEmail.status, 400);
  assert.equal(
    ((await badEmail.json()) as { fields?: Record<string, string> }).fields?.email,
    "invalidEmail"
  );

  const malformed = await fetch(`${BASE}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  });
  assert.equal(malformed.status, 400);
});

/**
 * The registration endpoint is authenticated (see migration 006 and
 * `registration-workflow.test.ts`): approval turns the submitter into the
 * club's owner and head coach, so an anonymous submission has no one to
 * promote. Authentication is checked *before* validation, so a malformed
 * anonymous body is still a 401 — the endpoint must not become an
 * unauthenticated validation oracle.
 *
 * The authenticated validation/upload rules are covered in
 * `registration-workflow.test.ts`, which has a session to submit with.
 */
test("the registration endpoint rejects an anonymous submission before validating it", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const form = new FormData();
  form.set("clubName", "X"); // deliberately incomplete
  const response = await fetch(`${BASE}/api/registrations`, {
    method: "POST",
    body: form,
  });
  assert.equal(response.status, 401);
  const body = (await response.json()) as { fields?: unknown; error?: string };
  assert.equal(body.error, "unauthenticated");
  assert.equal(body.fields, undefined, "no field-level detail leaks to an anonymous caller");
});

test("an anonymous upload cannot reach the file handling at all", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const form = new FormData();
  form.set("clubName", "Upload Test Club");
  form.set("operatingRegion", "Testville");
  form.set("representativeName", "Tester");
  form.set("representativeEmail", "upload-test@example.com");
  form.append(
    "documents",
    new File(["<script>alert(1)</script>"], "evil.html", { type: "text/html" })
  );
  const response = await fetch(`${BASE}/api/registrations`, {
    method: "POST",
    body: form,
  });
  assert.equal(response.status, 401);
});

test("the public live feed is readable without authentication and is not cached", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const response = await fetch(`${BASE}/api/live`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const body = (await response.json()) as Record<string, unknown>;
  for (const key of ["live", "recent", "upcoming", "fetchedAt"]) {
    assert.ok(key in body, `missing ${key}`);
  }
});

test("the public live event stream is read-only SSE", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const controller = new AbortController();
  const response = await fetch(`${BASE}/api/live/events`, { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  controller.abort();
  const write = await fetch(`${BASE}/api/live/events`, { method: "POST" });
  assert.equal(write.status, 405);
});

test("the public club-document route needs no session but never serves a non-public/nonexistent document", async (t) => {
  if (!serverUp) return t.skip("server not running");
  // No session cookie at all — this is the point of the route.
  const noSuchClub = await fetch(`${BASE}/api/clubs/no-such-club-xyz/documents/1`);
  assert.equal(noSuchClub.status, 404);

  const noSuchDoc = await fetch(`${BASE}/api/clubs/no-such-club-xyz/documents/999999999`);
  assert.equal(noSuchDoc.status, 404);
});
