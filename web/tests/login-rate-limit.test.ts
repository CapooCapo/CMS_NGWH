import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { pool, query, transaction } from "../src/server/db/pool";
import { POST as adminLogin } from "../src/app/api/admin/login/route";
import { POST as ownerLogin } from "../src/app/api/owner/login/route";
import {
  checkLoginLimit, clearSuccessfulLogin, clientIp,
  LoginRateLimitUnavailable, normalizedLoginAccount, recordFailedLogin,
} from "../src/server/security/loginRateLimit";

const secret = `test-only-${randomUUID()}`;
const originalSecret = process.env.LOGIN_RATE_LIMIT_SECRET;
const originalTrust = process.env.TRUST_PROXY_X_FORWARDED_FOR;
const cleanup = new Set<string>();
const unlocked = { locked: false, retryAfterSeconds: 0 };

before(async () => {
  process.env.LOGIN_RATE_LIMIT_SECRET = secret;
  process.env.TRUST_PROXY_X_FORWARDED_FOR = "true";
  // Deliberately fail if CI did not run the real migration.
  await query("SELECT key_hash FROM login_rate_limits LIMIT 0");
});

after(async () => {
  try {
    await query("DELETE FROM login_rate_limits WHERE key_hash = ANY($1::text[])", [[...cleanup]]);
  } finally {
    if (originalSecret === undefined) delete process.env.LOGIN_RATE_LIMIT_SECRET;
    else process.env.LOGIN_RATE_LIMIT_SECRET = originalSecret;
    if (originalTrust === undefined) delete process.env.TRUST_PROXY_X_FORWARDED_FOR;
    else process.env.TRUST_PROXY_X_FORWARDED_FOR = originalTrust;
    await pool.end();
  }
});

function key(identity: string, scope = "account") {
  const value = scope === "account" ? normalizedLoginAccount(identity) : identity;
  const result = `login-limit:${scope}:${createHmac("sha256", secret).update(value).digest("base64url")}`;
  cleanup.add(result);
  return result;
}

function account() {
  const value = `${randomUUID()}@example.test`;
  key(value);
  return value;
}

async function snapshot(identity: string, scope = "account") {
  const [row] = await query<{
    key_hash: string; scope: string; failure_count: number; lock_level: number;
    locked_until: Date | null; failure_expires_at: Date | null;
    level_expires_at: Date | null; updated_at: Date;
  }>("SELECT * FROM login_rate_limits WHERE key_hash=$1", [key(identity, scope)]);
  return row;
}

async function cycle(identity: string, seconds: number, ip: string | null = null) {
  if (ip) key(ip, "ip");
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(await checkLoginLimit(ip, identity), unlocked);
    assert.deepEqual(await recordFailedLogin(ip, identity), unlocked);
    assert.equal((await snapshot(identity)).failure_count, i + 1);
  }
  const result = await recordFailedLogin(ip, identity);
  assert.equal(result.locked, true);
  assert.ok(result.retryAfterSeconds <= seconds && result.retryAfterSeconds >= seconds - 1);
  const row = await snapshot(identity);
  assert.equal(row.failure_count, 0);
  assert.equal(row.locked_until!.getTime() - row.updated_at.getTime(), seconds * 1000);
}

async function expireLock(identity: string) {
  await query("UPDATE login_rate_limits SET locked_until=clock_timestamp()-interval '1 second' WHERE key_hash=$1", [key(identity)]);
  assert.deepEqual(await checkLoginLimit(null, identity), unlocked);
}

test("first five PostgreSQL failures are allowed; sixth locks for 30 seconds", async () => {
  await cycle(account(), 30);
});

test("remaining TTL decreases and blocked checks/record races leave all state unchanged", async () => {
  const identity = account();
  await cycle(identity, 30);
  // Move this disposable row's clock forward without waiting in real time.
  await query("UPDATE login_rate_limits SET locked_until=clock_timestamp()+interval '20 seconds' WHERE key_hash=$1", [key(identity)]);
  const before = await snapshot(identity);
  let previousRetryAfterSeconds = (await checkLoginLimit(null, identity)).retryAfterSeconds;
  for (let i = 0; i < 3; i++) {
    const checked = await checkLoginLimit(null, identity);
    const recorded = await recordFailedLogin(null, identity);
    const after = await snapshot(identity);
    assert.ok(checked.retryAfterSeconds > 0);
    assert.ok(checked.retryAfterSeconds <= previousRetryAfterSeconds);
    assert.ok(recorded.retryAfterSeconds > 0);
    assert.ok(recorded.retryAfterSeconds <= checked.retryAfterSeconds);
    assert.deepEqual(after, before);
    previousRetryAfterSeconds = recorded.retryAfterSeconds;
  }
});

test("completed cycles progress 30, 60, 120, 300, 300 seconds and never exceed the cap", async () => {
  const identity = account();
  for (const seconds of [30, 60, 120, 300, 300]) {
    await cycle(identity, seconds);
    assert.ok((await checkLoginLimit(null, identity)).retryAfterSeconds <= 300);
    await expireLock(identity);
  }
  assert.equal((await snapshot(identity)).lock_level, 4);
});

test("account A cannot lock account B; missing IP creates only an obscured account row", async () => {
  const a = account(), b = account();
  await cycle(a, 30);
  assert.deepEqual(await checkLoginLimit(null, b), unlocked);
  assert.equal(await snapshot(b), undefined);
  const row = await snapshot(a);
  assert.equal(row.scope, "account");
  assert.match(row.key_hash, /^login-limit:account:[A-Za-z0-9_-]{43}$/);
  assert.ok(!JSON.stringify(row).includes(a));
});

test("trusted IP accumulates across accounts while another IP remains independent", async () => {
  const ip = "198.51.100.10";
  key(ip, "ip");
  for (let i = 0; i < 6; i++) await recordFailedLogin(ip, account());
  const identity = account();
  assert.equal((await checkLoginLimit(ip, identity)).locked, true);
  assert.deepEqual(await checkLoginLimit("198.51.100.11", identity), unlocked);
  assert.deepEqual(await checkLoginLimit(null, identity), unlocked);
  const row = await snapshot(ip, "ip");
  assert.equal(row.scope, "trusted_ip");
  assert.ok(!JSON.stringify(row).includes(ip));
});

test("a locked account also blocks from a new IP", async () => {
  const identity = account();
  await cycle(identity, 30);
  assert.equal((await checkLoginLimit("198.51.100.12", identity)).locked, true);
});

test("success resets account count, lock, level and expiries without changing IP or other accounts", async () => {
  const identity = account(), other = account(), ip = "198.51.100.20";
  await cycle(identity, 30, ip);
  await recordFailedLogin(null, other);
  const ipBefore = await snapshot(ip, "ip"), otherBefore = await snapshot(other);
  await clearSuccessfulLogin(identity);
  const row = await snapshot(identity);
  assert.equal(row.failure_count, 0);
  assert.equal(row.lock_level, 0);
  assert.equal(row.locked_until, null);
  assert.equal(row.failure_expires_at, null);
  assert.equal(row.level_expires_at, null);
  assert.deepEqual(await snapshot(ip, "ip"), ipBefore);
  assert.deepEqual(await snapshot(other), otherBefore);
  assert.deepEqual(await checkLoginLimit(null, identity), unlocked);
  await cycle(identity, 30);
});

test("expired failure window resets the count without background cleanup", async () => {
  const identity = account();
  for (let i = 0; i < 5; i++) await recordFailedLogin(null, identity);
  await query("UPDATE login_rate_limits SET failure_expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1", [key(identity)]);
  assert.deepEqual(await recordFailedLogin(null, identity), unlocked);
  assert.equal((await snapshot(identity)).failure_count, 1);
});

test("expired level window resets progression without background cleanup", async () => {
  const identity = account();
  await cycle(identity, 30);
  await expireLock(identity);
  await cycle(identity, 60);
  await expireLock(identity);
  await query("UPDATE login_rate_limits SET level_expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1", [key(identity)]);
  await cycle(identity, 30);
  assert.equal((await snapshot(identity)).lock_level, 1);
});

test("five concurrent first failures lose no increments for account or IP", async () => {
  const identity = account(), ip = "198.51.100.30";
  key(ip, "ip");
  const results = await Promise.all(Array.from({ length: 5 }, () => recordFailedLogin(ip, identity)));
  assert.ok(results.every((result) => !result.locked));
  assert.equal((await snapshot(identity)).failure_count, 5);
  assert.equal((await snapshot(ip, "ip")).failure_count, 5);
});

test("concurrent threshold crossings create exactly one lock and one level", async () => {
  const identity = account();
  const results = await Promise.all(Array.from({ length: 12 }, () => recordFailedLogin(null, identity)));
  assert.equal(results.filter((result) => !result.locked).length, 5);
  assert.equal(results.filter((result) => result.locked).length, 7);
  const row = await snapshot(identity);
  assert.equal(row.failure_count, 0);
  assert.equal(row.lock_level, 1);
  assert.equal(row.locked_until!.getTime() - row.updated_at.getTime(), 30_000);
});

test("a check-to-record race against a locked IP does not increment the account", async () => {
  const identity = account(), ip = "198.51.100.40";
  key(ip, "ip");
  await recordFailedLogin(null, identity);
  const before = await snapshot(identity);
  assert.deepEqual(await checkLoginLimit(ip, identity), unlocked);
  for (let i = 0; i < 6; i++) await recordFailedLogin(ip, account());
  const ipBefore = await snapshot(ip, "ip");
  assert.equal((await recordFailedLogin(ip, identity)).locked, true);
  assert.deepEqual(await snapshot(identity), before);
  assert.deepEqual(await snapshot(ip, "ip"), ipBefore);
});

test("both login routes return 401 for attempts 1-5, then 429 with database Retry-After", async () => {
  for (const [handler, field] of [[adminLogin, "username"], [ownerLogin, "email"]] as const) {
    const identity = account();
    for (let attempt = 1; attempt <= 6; attempt++) {
      const response = await handler(new Request("http://test/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: identity, password: "invalid-test-only" }),
      }));
      assert.equal(response.status, attempt <= 5 ? 401 : 429);
      assert.equal(response.headers.get("set-cookie"), null);
      if (attempt === 6) {
        assert.equal((await response.json()).error, "tooManyRequests");
        assert.ok(Number(response.headers.get("retry-after")) <= 30);
        assert.ok(Number(response.headers.get("retry-after")) >= 29);
      }
    }
  }
});

test("database read failure stops both login handlers before account lookup and returns opaque 503", async () => {
  const logs = mock.method(console, "error", () => {});
  try {
    for (const [handler, field] of [[adminLogin, "username"], [ownerLogin, "email"]] as const) {
      const rollback = new Error("test rollback");
      await assert.rejects(transaction(async (client) => {
        // Real missing-table failure in this transaction only.
        await client.query("SET LOCAL search_path TO pg_catalog");
        const spy = mock.method(client, "query");
        try {
          const response = await handler(new Request("http://test/login", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ [field]: account(), password: "never-verify-this" }),
          }));
          assert.equal(response.status, 503);
          assert.deepEqual(await response.json(), { error: "server" });
          assert.equal(response.headers.get("set-cookie"), null);
          const statements = spy.mock.calls.map((call) => String(call.arguments[0])).join(" ");
          assert.doesNotMatch(statements, /admin_users|club_owners|sessions/i);
        } finally {
          spy.mock.restore();
        }
        throw rollback;
      }), rollback);
    }
    assert.ok(logs.mock.calls.length >= 2);
    for (const call of logs.mock.calls) {
      assert.deepEqual(call.arguments, ["login rate limiter unavailable", { operation: "check", reason: "database_failure" }]);
    }
  } finally {
    logs.mock.restore();
  }
});

test("database write/reset failures fail closed and preserve committed state", async () => {
  const identity = account();
  await recordFailedLogin(null, identity);
  const before = await snapshot(identity);
  const logs = mock.method(console, "error", () => {});
  try {
    for (const operation of [() => recordFailedLogin(null, identity), () => clearSuccessfulLogin(identity)]) {
      const rollback = new Error("test rollback");
      await assert.rejects(transaction(async (client) => {
        await client.query("SET TRANSACTION READ ONLY");
        await assert.rejects(operation, LoginRateLimitUnavailable);
        throw rollback;
      }), rollback);
      assert.deepEqual(await snapshot(identity), before);
    }
  } finally {
    logs.mock.restore();
  }
});

test("missing HMAC configuration fails closed without logging identities or secrets", async () => {
  const logs = mock.method(console, "error", () => {});
  delete process.env.LOGIN_RATE_LIMIT_SECRET;
  try {
    await assert.rejects(() => checkLoginLimit(null, "private@example.test"), LoginRateLimitUnavailable);
    assert.deepEqual(logs.mock.calls[0].arguments, ["login rate limiter unavailable", {
      operation: "check", reason: "missing_configuration",
    }]);
  } finally {
    process.env.LOGIN_RATE_LIMIT_SECRET = secret;
    logs.mock.restore();
  }
});

test("trusted-IP parsing and case-insensitive account identity remain unchanged", async () => {
  const from = (value?: string) => clientIp(new Request("http://test", {
    headers: value ? { "x-forwarded-for": value } : undefined,
  }));
  assert.equal(from("198.51.100.10, 10.0.0.1"), "198.51.100.10");
  assert.equal(from("2001:db8::1"), "2001:db8::1");
  assert.equal(from(), null);
  assert.equal(from("invalid"), null);
  process.env.TRUST_PROXY_X_FORWARDED_FOR = "false";
  assert.equal(from("198.51.100.10"), null);
  process.env.TRUST_PROXY_X_FORWARDED_FOR = "true";
  const identity = account();
  await recordFailedLogin(null, ` ${identity.toUpperCase()} `);
  await recordFailedLogin(null, identity);
  assert.equal((await snapshot(identity)).failure_count, 2);
});
