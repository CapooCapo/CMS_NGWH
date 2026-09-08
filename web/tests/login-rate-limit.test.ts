import { after, afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  checkLoginLimit,
  clearSuccessfulLogin,
  clientIp,
  LOGIN_LOCK_DURATIONS_SECONDS,
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

type MemoryState = {
  failureCount: number;
  lockLevel: number;
  lockUntil: number;
};

class MemoryRateLimitStore implements LoginRateLimitStore {
  private readonly states = new Map<string, MemoryState>();
  private now = 0;

  private keys(ip: string | null, account: string): string[] {
    return [
      ...(ip ? [`ip:${ip}`] : []),
      `account:${account}`,
    ];
  }

  advance(seconds: number) {
    this.now += seconds * 1_000;
  }

  private state(key: string): MemoryState {
    const existing = this.states.get(key);
    if (existing) return existing;
    const state = { failureCount: 0, lockLevel: 0, lockUntil: 0 };
    this.states.set(key, state);
    return state;
  }

  private limit(keys: string[]): LoginRateLimit {
    const remaining = keys
      .map((key) => this.state(key).lockUntil - this.now)
      .filter((milliseconds) => milliseconds > 0);
    return remaining.length === 0
      ? { locked: false, retryAfterSeconds: 0 }
      : { locked: true, retryAfterSeconds: Math.ceil(Math.max(...remaining) / 1_000) };
  }

  async check(ip: string | null, account: string): Promise<LoginRateLimit> {
    return this.limit(this.keys(ip, account));
  }

  async recordFailure(ip: string | null, account: string): Promise<LoginRateLimit> {
    const keys = this.keys(ip, account);
    for (const key of keys) {
      const state = this.state(key);
      if (state.lockUntil > this.now) continue;
      if (state.lockUntil > 0) {
        state.lockUntil = 0;
        state.failureCount = 0;
      }
      state.failureCount += 1;
      if (state.failureCount > LOGIN_RATE_LIMIT_MAX_FAILURES) {
        state.lockLevel = Math.min(state.lockLevel + 1, LOGIN_LOCK_DURATIONS_SECONDS.length);
        state.lockUntil = this.now + LOGIN_LOCK_DURATIONS_SECONDS[state.lockLevel - 1] * 1_000;
        state.failureCount = 0;
      }
    }
    return this.limit(keys);
  }

  async clearAccount(account: string): Promise<void> {
    this.states.delete(`account:${account}`);
  }
}

afterEach(() => setLoginRateLimitStoreForTests(undefined));

async function fail(ip: string | null, account: string) {
  const existing = await checkLoginLimit(ip, account);
  if (existing.locked) return existing;
  return recordFailedLogin(ip, account);
}

async function lockCycle(
  ip: string | null,
  account: string,
  seconds: number
) {
  for (let attempt = 1; attempt <= LOGIN_RATE_LIMIT_MAX_FAILURES; attempt++) {
    assert.deepEqual(await fail(ip, account), {
      locked: false,
      retryAfterSeconds: 0,
    }, `attempt ${attempt} remains eligible for the route's 401 response`);
  }
  assert.deepEqual(await fail(ip, account), {
    locked: true,
    retryAfterSeconds: seconds,
  });
}

test("attempts 1-5 remain 401-eligible and attempt 6 starts a 30-second lock", async () => {
  const store = new MemoryRateLimitStore();
  setLoginRateLimitStoreForTests(store);

  await lockCycle("198.51.100.10", "account-a", 30);
});

test("Retry-After decreases and blocked requests do not extend the lock", async () => {
  const store = new MemoryRateLimitStore();
  setLoginRateLimitStoreForTests(store);
  await lockCycle(null, "account-a", 30);

  store.advance(10);
  assert.deepEqual(await fail(null, "account-a"), { locked: true, retryAfterSeconds: 20 });
  // recordFailure also defends the check-then-record race without refreshing
  // the lock TTL.
  assert.deepEqual(await recordFailedLogin(null, "account-a"), {
    locked: true,
    retryAfterSeconds: 20,
  });
  store.advance(10);
  assert.deepEqual(await checkLoginLimit(null, "account-a"), {
    locked: true,
    retryAfterSeconds: 10,
  });
});

test("each completed failure cycle progresses 30, 60, 120, then caps at 300 seconds", async () => {
  const store = new MemoryRateLimitStore();
  setLoginRateLimitStoreForTests(store);
  const account = "account-a";

  for (const seconds of [30, 60, 120, 300, 300]) {
    await lockCycle(null, account, seconds);
    assert.ok(seconds <= 300);
    store.advance(seconds);
    assert.deepEqual(await checkLoginLimit(null, account), {
      locked: false,
      retryAfterSeconds: 0,
    });
  }
});

test("a successful login reset returns the account to the first lock level only", async () => {
  const store = new MemoryRateLimitStore();
  setLoginRateLimitStoreForTests(store);
  await lockCycle(null, "account-a", 30);
  store.advance(30);

  await clearSuccessfulLogin("account-a");
  await lockCycle(null, "account-a", 30);
});

test("missing IPs remain account-only and cannot lock unrelated accounts", async () => {
  const store = new MemoryRateLimitStore();
  setLoginRateLimitStoreForTests(store);

  await lockCycle(null, "account-a", 30);
  assert.equal((await checkLoginLimit(null, "account-a")).locked, true);
  assert.equal((await checkLoginLimit(null, "account-b")).locked, false);
});

test("trusted IP and account keys each independently enforce a limit", async () => {
  const store = new MemoryRateLimitStore();
  setLoginRateLimitStoreForTests(store);

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
