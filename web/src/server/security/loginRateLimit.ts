import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { PoolClient } from "pg";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_DURATIONS_MS = [30_000, 60_000, 120_000, 300_000] as const;

export class LoginRateLimitUnavailable extends Error {
  constructor() {
    super("Login rate limiter is unavailable");
  }
}

export type LoginRateLimit = { locked: boolean; retryAfterSeconds: number };
type Identity = { hash: string; scope: "account" | "trusted_ip" };
type State = {
  key_hash: string;
  failure_count: number;
  lock_level: number;
  locked_until: Date | null;
  failure_expires_at: Date | null;
  level_expires_at: Date | null;
};

export function normalizedLoginAccount(account: string): string {
  return account.trim().toLowerCase();
}

function identities(ip: string | null, account: string): Identity[] {
  const secret = process.env.LOGIN_RATE_LIMIT_SECRET;
  if (!secret?.trim()) throw new LoginRateLimitUnavailable();
  const digest = (value: string) => createHmac("sha256", secret).update(value).digest("base64url");
  // Preserve established HMAC identities, with separate account/IP prefixes.
  return [
    { hash: `login-limit:account:${digest(normalizedLoginAccount(account))}`, scope: "account" as const },
    ...(ip ? [{ hash: `login-limit:ip:${digest(ip)}`, scope: "trusted_ip" as const }] : []),
  ].sort((a, b) => a.hash.localeCompare(b.hash));
}

export function clientIp(request: Request): string | null {
  if (process.env.TRUST_PROXY_X_FORWARDED_FOR !== "true") return null;
  const candidate = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

async function protectedOperation<T>(operation: "check" | "failure" | "reset", run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Driver messages may contain credentials or identities. Log no original
    // exception, SQL parameters, key hashes or connection strings.
    console.error("login rate limiter unavailable", {
      operation,
      reason: error instanceof LoginRateLimitUnavailable ? "missing_configuration" : "database_failure",
    });
    throw new LoginRateLimitUnavailable();
  }
}

async function remaining(client: PoolClient, hashes: string[]): Promise<LoginRateLimit> {
  const { rows } = await client.query<{ seconds: number }>(
    `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (MAX(locked_until) - clock_timestamp()))))::integer AS seconds
       FROM login_rate_limits WHERE key_hash = ANY($1::text[])`,
    [hashes]
  );
  const seconds = rows[0].seconds;
  return { locked: seconds > 0, retryAfterSeconds: seconds };
}

async function withDatabase<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  // Lazy loading also maps absent DB configuration to an opaque failure.
  // Importing clientIp alone must not initialise a database pool.
  const { transaction } = await import("@/server/db/pool");
  return transaction(async (client) => {
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    return run(client);
  });
}

export async function checkLoginLimit(ip: string | null, account: string): Promise<LoginRateLimit> {
  return protectedOperation("check", async () => {
    const hashes = identities(ip, account).map((identity) => identity.hash);
    // Read-only: never create rows or refresh expiry. Failure recording
    // rechecks locks to close the check/password/record race.
    return withDatabase((client) => remaining(client, hashes));
  });
}

export async function recordFailedLogin(ip: string | null, account: string): Promise<LoginRateLimit> {
  return protectedOperation("failure", async () => {
    const keys = identities(ip, account);
    const hashes = keys.map((key) => key.hash);
    return withDatabase(async (client) => {
      // Identical ordering for insertion and locking prevents deadlocks.
      // ON CONFLICT waits for a concurrent first insertion to commit.
      for (const key of keys) {
        await client.query(
          "INSERT INTO login_rate_limits (key_hash, scope) VALUES ($1, $2) ON CONFLICT (key_hash) DO NOTHING",
          [key.hash, key.scope]
        );
      }
      const { rows } = await client.query<State>(
        `SELECT key_hash, failure_count, lock_level, locked_until, failure_expires_at, level_expires_at
           FROM login_rate_limits WHERE key_hash = ANY($1::text[]) ORDER BY key_hash FOR UPDATE`,
        [hashes]
      );
      if (rows.length !== keys.length) throw new Error("limiter state missing");
      // NOW() precedes any lock wait. Use database wall time after row locks.
      const { rows: clock } = await client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const now = clock[0].now;
      const active = (expiry: Date | null) => expiry !== null && expiry.getTime() > now.getTime();
      if (rows.some((row) => active(row.locked_until))) return remaining(client, hashes);

      for (const row of rows) {
        const count = (active(row.failure_expires_at) ? row.failure_count : 0) + 1;
        let level = active(row.level_expires_at) ? row.lock_level : 0;
        let lockedUntil: Date | null = null;
        let failureExpiresAt = active(row.failure_expires_at) ? row.failure_expires_at : new Date(now.getTime() + WINDOW_MS);
        let levelExpiresAt = active(row.level_expires_at) ? row.level_expires_at : null;
        if (count > MAX_FAILURES) {
          level = Math.min(level + 1, LOCK_DURATIONS_MS.length);
          lockedUntil = new Date(now.getTime() + LOCK_DURATIONS_MS[level - 1]);
          failureExpiresAt = null;
          levelExpiresAt = new Date(now.getTime() + WINDOW_MS);
        }
        await client.query(
          `UPDATE login_rate_limits
              SET failure_count = $2, lock_level = $3, locked_until = $4,
                  failure_expires_at = $5, level_expires_at = $6, updated_at = $7
            WHERE key_hash = $1`,
          [row.key_hash, lockedUntil ? 0 : count, level, lockedUntil, failureExpiresAt, levelExpiresAt, now]
        );
      }
      return remaining(client, hashes);
    });
  });
}

export async function clearSuccessfulLogin(account: string): Promise<void> {
  return protectedOperation("reset", async () => {
    const [identity] = identities(null, account);
    await withDatabase(async (client) => {
      // UPDATE locks and serializes with failures. Retaining an empty row
      // avoids deletion racing between INSERT and SELECT FOR UPDATE.
      await client.query(
        `UPDATE login_rate_limits SET failure_count = 0, lock_level = 0,
            locked_until = NULL, failure_expires_at = NULL, level_expires_at = NULL,
            updated_at = clock_timestamp()
          WHERE key_hash = $1 AND scope = 'account'`,
        [identity.hash]
      );
    });
  });
}

export const LOGIN_RATE_LIMIT_WINDOW_MS = WINDOW_MS;
export const LOGIN_RATE_LIMIT_MAX_FAILURES = MAX_FAILURES;
export const LOGIN_LOCK_DURATIONS_SECONDS = LOCK_DURATIONS_MS.map((duration) => duration / 1000);
