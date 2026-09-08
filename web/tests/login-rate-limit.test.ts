import { after, afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  checkLoginLimit,
  clearSuccessfulLogin,
  clientIp,
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  normalizedLoginAccount,
  recordFailedLogin,
  setLoginRateLimitStoreForTests,
  type LoginRateLimit,
  type LoginRateLimitStore,
} from "../src/server/security/loginRateLimit";

const originalTrustProxy = process.env.TRUST_PROXY_X_FORWARDED_FOR;

before(() => {
  process.env.TRUST_PROXY_X_FORWARDED_FOR = "true";
});

after(() => {
  if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_X_FORWARDED_FOR;
  else process.env.TRUST_PROXY_X_FORWARDED_FOR = originalTrustProxy;
});

class MemoryRateLimitStore implements LoginRateLimitStore {
  private readonly failures = new Map<string, number>();

  private keys(ip: string | null, account: string): string[] {
    return [
      ...(ip ? [`ip:${ip}`] : []),
      `account:${account}`,
    ];
  }

  private limit(keys: string[]): LoginRateLimit {
    const locked = keys.some((key) => (this.failures.get(key) ?? 0) > LOGIN_RATE_LIMIT_MAX_FAILURES);
    return { locked, retryAfterSeconds: locked ? 900 : 0 };
  }

  async check(ip: string | null, account: string): Promise<LoginRateLimit> {
    return this.limit(this.keys(ip, account));
  }

  async recordFailure(ip: string | null, account: string): Promise<LoginRateLimit> {
    const keys = this.keys(ip, account);
    for (const key of keys) this.failures.set(key, (this.failures.get(key) ?? 0) + 1);
    return this.limit(keys);
  }

  async clearAccount(account: string): Promise<void> {
    this.failures.delete(`account:${account}`);
  }
}

afterEach(() => setLoginRateLimitStoreForTests(undefined));

async function fail(ip: string | null, account: string) {
  const existing = await checkLoginLimit(ip, account);
  if (existing.locked) return existing;
  return recordFailedLogin(ip, account);
}

test("five failures are allowed and the sixth returns a lock with Retry-After", async () => {
  setLoginRateLimitStoreForTests(new MemoryRateLimitStore());

  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.deepEqual(await fail("198.51.100.10", "account-a"), {
      locked: false,
      retryAfterSeconds: 0,
    }, `attempt ${attempt}`);
  }
  assert.deepEqual(await fail("198.51.100.10", "account-a"), {
    locked: true,
    retryAfterSeconds: 900,
  });
});

test("missing IPs remain account-only and cannot lock unrelated accounts", async () => {
  setLoginRateLimitStoreForTests(new MemoryRateLimitStore());

  for (let attempt = 0; attempt < 6; attempt++) await fail(null, "account-a");
  assert.equal((await checkLoginLimit(null, "account-a")).locked, true);
  assert.equal((await checkLoginLimit(null, "account-b")).locked, false);
});

test("trusted IP and account keys each independently enforce a limit", async () => {
  setLoginRateLimitStoreForTests(new MemoryRateLimitStore());

  for (let attempt = 0; attempt < 6; attempt++) await fail("198.51.100.20", `account-${attempt}`);
  assert.equal((await checkLoginLimit("198.51.100.20", "another-account")).locked, true);

  await clearSuccessfulLogin("account-0");
  assert.equal((await checkLoginLimit("198.51.100.21", "account-0")).locked, false);
  assert.equal((await checkLoginLimit("198.51.100.20", "another-account")).locked, true);
});

test("client IP accepts only valid trusted IPv4 or IPv6 forwarding values", () => {
  const from = (value?: string) => clientIp(new Request("http://test", {
    headers: value ? { "x-forwarded-for": value } : undefined,
  }));
  assert.equal(from("198.51.100.10, 10.0.0.1"), "198.51.100.10");
  assert.equal(from("2001:db8::1"), "2001:db8::1");
  assert.equal(from(), null);
  assert.equal(from("not-an-ip"), null);
});

test("account limiter keys are case-insensitive like staff username lookup", () => {
  assert.equal(normalizedLoginAccount(" Admin "), "admin");
  assert.equal(normalizedLoginAccount("ADMIN"), "admin");
});

test("development uses a local limiter when no Upstash service is configured", async () => {
  // No injected store: this exercises the local development fallback used by
  // the login routes in a standard `.env.local` setup.
  const account = `local-${Date.now()}@example.test`;
  assert.deepEqual(await checkLoginLimit(null, account), {
    locked: false,
    retryAfterSeconds: 0,
  });
  for (let attempt = 0; attempt < LOGIN_RATE_LIMIT_MAX_FAILURES + 1; attempt++) {
    await recordFailedLogin(null, account);
  }
  assert.equal((await checkLoginLimit(null, account)).locked, true);
  await clearSuccessfulLogin(account);
  assert.equal((await checkLoginLimit(null, account)).locked, false);
});
