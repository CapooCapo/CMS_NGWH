import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const UPSTASH_TIMEOUT_MS = 5_000;

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

const CHECK_SCRIPT = `
local retry = 0
for i, key in ipairs(KEYS) do
  local count = tonumber(redis.call('GET', key)) or 0
  if count > tonumber(ARGV[1]) then
    local ttl = redis.call('PTTL', key)
    if ttl > retry then retry = ttl end
  end
end
return retry`;

const RECORD_SCRIPT = `
local retry = 0
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('PEXPIRE', key, ARGV[1]) end
  if count > tonumber(ARGV[2]) then
    local ttl = redis.call('PTTL', key)
    if ttl > retry then retry = ttl end
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
      WINDOW_MS,
      MAX_FAILURES,
    ]);
    return resultToLimit(result);
  }

  async clearAccount(account: string): Promise<void> {
    // Do not clear the IP bucket: a successful account must not reset an
    // attacker’s aggregate failure history for that address.
    await command(["DEL", `login-limit:account:${keyPart(account)}`]);
  }
}

type LocalFailure = { count: number; expiresAt: number };

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

  private count(key: string, now: number): LocalFailure | undefined {
    const failure = this.failures.get(key);
    if (failure && failure.expiresAt <= now) {
      this.failures.delete(key);
      return undefined;
    }
    return failure;
  }

  private limit(keys: readonly string[], now: number): LoginRateLimit {
    const locked = keys
      .map((key) => this.count(key, now))
      .filter((failure): failure is LocalFailure => Boolean(failure && failure.count > MAX_FAILURES));
    if (locked.length === 0) return { locked: false, retryAfterSeconds: 0 };
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil(Math.max(...locked.map((failure) => failure.expiresAt - now)) / 1000)),
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
      const existing = this.count(key, now);
      this.failures.set(key, {
        count: (existing?.count ?? 0) + 1,
        expiresAt: existing?.expiresAt ?? now + WINDOW_MS,
      });
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
