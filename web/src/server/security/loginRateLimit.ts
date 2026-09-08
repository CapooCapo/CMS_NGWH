import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const UPSTASH_TIMEOUT_MS = 5_000;
const LOCK_LEVEL_TTL_MS = WINDOW_MS;
const LOCK_DURATIONS_MS = [30_000, 60_000, 120_000, 300_000] as const;

type UpstashReply = { result?: unknown; error?: string };
type FetchLike = typeof fetch;

export class LoginRateLimitUnavailable extends Error {
  constructor() {
    super("Login rate limiter is unavailable");
  }
}

export type LoginRateLimit = {
  locked: boolean;
  retryAfterSeconds: number;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new LoginRateLimitUnavailable();
  return value;
}

function keyPart(value: string): string {
  return createHmac("sha256", required("LOGIN_RATE_LIMIT_SECRET"))
    .update(value)
    .digest("base64url");
}

/** Identity keys must match the case-insensitive staff-account lookup. */
export function normalizedLoginAccount(account: string): string {
  return account.trim().toLowerCase();
}

function keys(ip: string | null, account: string) {
  const accountKey = `login-limit:account:${keyPart(account)}`;
  // A missing forwarding header is not an address. In particular, never put
  // every direct request into a shared "unknown" bucket.
  return ip ? [`login-limit:ip:${keyPart(ip)}`, accountKey] : [accountKey];
}

async function command(args: (string | number)[], fetcher: FetchLike = fetch): Promise<unknown> {
  const url = required("UPSTASH_REDIS_REST_URL");
  const token = required("UPSTASH_REDIS_REST_TOKEN");
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });
  } catch {
    throw new LoginRateLimitUnavailable();
  }
  let body: UpstashReply;
  try {
    body = (await response.json()) as UpstashReply;
  } catch {
    throw new LoginRateLimitUnavailable();
  }
  if (!response.ok || body.error) throw new LoginRateLimitUnavailable();
  return body.result;
}

/*
 * Each HMAC-obscured identity key keeps three independent Redis values:
 *
 *   <key>          failure count for the current cycle
 *   <key>:lock     short-lived lock key (its PTTL is the exact retry time)
 *   <key>:level    progressive lock level, retained for a bounded window
 *
 * A separate lock key is important: a request rejected while locked only
 * reads PTTL, so it can never extend the lock. Keeping the level separate
 * lets the next six-failure cycle advance from 30 -> 60 -> 120 -> 300s.
 *
 * The legacy failure-count key is deliberately retained as the base key.
 * Existing pre-deploy locks remain honored by CHECK_SCRIPT until their old
 * TTL expires, rather than being silently cleared during deployment.
 */
const CHECK_SCRIPT = `
local retry = 0
local max_failures = tonumber(ARGV[1])
for i, key in ipairs(KEYS) do
  local lock_ttl = redis.call('PTTL', key .. ':lock')
  if lock_ttl > retry then retry = lock_ttl end

  -- The previous limiter stored a count directly at <key>. Honour an active
  -- legacy lock during rollout; new locks always use <key>:lock.
  if lock_ttl <= 0 then
    local legacy_count = tonumber(redis.call('GET', key)) or 0
    if legacy_count > max_failures then
      local legacy_ttl = redis.call('PTTL', key)
      if legacy_ttl > retry then retry = legacy_ttl end
    end
  end
end
return retry`;

const RECORD_SCRIPT = `
local retry = 0
local max_failures = tonumber(ARGV[1])
local failure_window = tonumber(ARGV[2])
local level_ttl = tonumber(ARGV[3])

for i, key in ipairs(KEYS) do
  local lock_key = key .. ':lock'
  local level_key = key .. ':level'
  local lock_ttl = redis.call('PTTL', lock_key)

  -- This also protects against a race between check() and recordFailure().
  -- Never increment a counter or refresh a TTL for an already locked key.
  if lock_ttl > 0 then
    if lock_ttl > retry then retry = lock_ttl end
  else
    local count = redis.call('INCR', key)
    if count == 1 then redis.call('PEXPIRE', key, failure_window) end

    if count > max_failures then
      local level = redis.call('INCR', level_key)
      if level > 4 then
        level = 4
        redis.call('SET', level_key, level)
      end
      redis.call('PEXPIRE', level_key, level_ttl)

      local duration = tonumber(ARGV[3 + level])
      redis.call('PSETEX', lock_key, duration, '1')
      -- A fresh cycle begins only after this lock naturally expires.
      redis.call('DEL', key)

      local actual_ttl = redis.call('PTTL', lock_key)
      if actual_ttl > retry then retry = actual_ttl end
    end
  end
end
return retry`;

function resultToLimit(result: unknown): LoginRateLimit {
  const ttl = typeof result === "number" ? result : Number(result);
  if (!Number.isFinite(ttl) || ttl <= 0) return { locked: false, retryAfterSeconds: 0 };
  return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) };
}

export function clientIp(request: Request): string | null {
  // Only a deployment that has a proxy configured to overwrite XFF may opt in
  // to trusting it. This also avoids treating development-server loopback
  // forwarding headers as a shared client identity.
  if (process.env.TRUST_PROXY_X_FORWARDED_FOR !== "true") return null;
  // Never trust a secondary client-controlled forwarding header as a fallback.
  // Invalid values are treated exactly like a missing header, so they cannot
  // become Redis or PostgreSQL keys.
  const candidate = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

export interface LoginRateLimitStore {
  check(ip: string | null, account: string): Promise<LoginRateLimit>;
  recordFailure(ip: string | null, account: string): Promise<LoginRateLimit>;
  clearAccount(account: string): Promise<void>;
}

class UpstashLoginRateLimitStore implements LoginRateLimitStore {
  async check(ip: string | null, account: string): Promise<LoginRateLimit> {
    const limitKeys = keys(ip, account);
    const result = await command(["EVAL", CHECK_SCRIPT, limitKeys.length, ...limitKeys, MAX_FAILURES]);
    return resultToLimit(result);
  }

  async recordFailure(ip: string | null, account: string): Promise<LoginRateLimit> {
    const limitKeys = keys(ip, account);
    const result = await command([
      "EVAL",
      RECORD_SCRIPT,
      limitKeys.length,
      ...limitKeys,
      MAX_FAILURES,
      WINDOW_MS,
      LOCK_LEVEL_TTL_MS,
      ...LOCK_DURATIONS_MS,
    ]);
    return resultToLimit(result);
  }

  async clearAccount(account: string): Promise<void> {
    // Do not clear the IP bucket: a successful account must not reset an
    // attacker’s aggregate failure history for that address. Account success
    // resets only that account's failure cycle, active lock and progression.
    const key = `login-limit:account:${keyPart(account)}`;
    await command(["DEL", key, `${key}:lock`, `${key}:level`]);
  }
}

type LocalFailure = {
  failureCount: number;
  failureExpiresAt: number;
  lockLevel: number;
  levelExpiresAt: number;
  lockUntil: number;
};

/**
 * Development has no shared Redis service by default. Keep the same bounded
 * behavior locally instead of making every login fail, while production stays
 * fail-closed when its required Upstash configuration is unavailable.
 */
class LocalLoginRateLimitStore implements LoginRateLimitStore {
  private readonly failures = new Map<string, LocalFailure>();

  private keys(ip: string | null, account: string): string[] {
    return [...(ip ? [`ip:${ip}`] : []), `account:${account}`];
  }

  private state(key: string, now: number): LocalFailure {
    const existing = this.failures.get(key);
    const failure: LocalFailure = existing ?? {
      failureCount: 0,
      failureExpiresAt: 0,
      lockLevel: 0,
      levelExpiresAt: 0,
      lockUntil: 0,
    };
    if (failure.failureExpiresAt <= now) failure.failureCount = 0;
    if (failure.levelExpiresAt <= now) failure.lockLevel = 0;
    this.failures.set(key, failure);
    return failure;
  }

  private limit(keys: readonly string[], now: number): LoginRateLimit {
    const locked = keys
      .map((key) => this.state(key, now).lockUntil - now)
      .filter((remaining) => remaining > 0);
    if (locked.length === 0) return { locked: false, retryAfterSeconds: 0 };
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil(Math.max(...locked) / 1000)),
    };
  }

  async check(ip: string | null, account: string): Promise<LoginRateLimit> {
    const now = Date.now();
    return this.limit(this.keys(ip, account), now);
  }

  async recordFailure(ip: string | null, account: string): Promise<LoginRateLimit> {
    const now = Date.now();
    const keys = this.keys(ip, account);
    for (const key of keys) {
      const failure = this.state(key, now);
      if (failure.lockUntil > now) continue;
      if (failure.lockUntil > 0) {
        failure.lockUntil = 0;
        failure.failureCount = 0;
      }
      failure.failureCount += 1;
      if (failure.failureCount === 1) failure.failureExpiresAt = now + WINDOW_MS;
      if (failure.failureCount > MAX_FAILURES) {
        failure.lockLevel = Math.min(failure.lockLevel + 1, LOCK_DURATIONS_MS.length);
        failure.levelExpiresAt = now + LOCK_LEVEL_TTL_MS;
        failure.lockUntil = now + LOCK_DURATIONS_MS[failure.lockLevel - 1];
        failure.failureCount = 0;
        failure.failureExpiresAt = 0;
      }
    }
    return this.limit(keys, now);
  }

  async clearAccount(account: string): Promise<void> {
    this.failures.delete(`account:${account}`);
  }
}

let testStore: LoginRateLimitStore | undefined;
const localStore = new LocalLoginRateLimitStore();

/** Test-only dependency injection; production always uses the Upstash store. */
export function setLoginRateLimitStoreForTests(store: LoginRateLimitStore | undefined): void {
  testStore = store;
}

function store(): LoginRateLimitStore {
  if (testStore) return testStore;
  // A deployment must configure the shared limiter; silently falling back
  // there would remove cross-instance protection during an outage.
  return process.env.NODE_ENV === "production"
    ? new UpstashLoginRateLimitStore()
    : localStore;
}

export async function checkLoginLimit(ip: string | null, account: string): Promise<LoginRateLimit> {
  return store().check(ip, account);
}

export async function recordFailedLogin(
  ip: string | null,
  account: string
): Promise<LoginRateLimit> {
  return store().recordFailure(ip, account);
}

export async function clearSuccessfulLogin(account: string): Promise<void> {
  await store().clearAccount(account);
}

/*
 * The compatibility exports below keep route call sites small while the
 * production implementation stays isolated behind LoginRateLimitStore.
 */
export const LOGIN_RATE_LIMIT_WINDOW_MS = WINDOW_MS;
export const LOGIN_RATE_LIMIT_MAX_FAILURES = MAX_FAILURES;
export const LOGIN_LOCK_DURATIONS_SECONDS = LOCK_DURATIONS_MS.map((duration) => duration / 1000) as [
  number,
  number,
  number,
  number,
];
