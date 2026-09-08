import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type QueryResultRow } from "pg";
import { databaseConnectionOptions } from "./options";

/**
 * Single shared connection pool.
 *
 * Next dev/HMR re-evaluates modules, which would otherwise leak a new pool per
 * reload and exhaust Postgres connections, so the pool is cached on globalThis.
 */
const globalForPool = globalThis as unknown as { ngwhPool?: Pool };
const transactionContext = new AsyncLocalStorage<import("pg").PoolClient>();

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and start the " +
        "database with `docker compose up -d`."
    );
  }
  return new Pool({ ...databaseConnectionOptions(connectionString), max: 10, idleTimeoutMillis: 30_000 });
}

export const pool: Pool = globalForPool.ngwhPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForPool.ngwhPool = pool;

/** Parameterised query. Never interpolate user input into SQL. */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const client = transactionContext.getStore();
  const result = client
    ? await client.query<T>(text, params as unknown[])
    : await pool.query<T>(text, params as unknown[]);
  return result.rows;
}

/** Convenience for queries expected to return at most one row. */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a transaction, rolling back on any throw. */
export async function transaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const existingClient = transactionContext.getStore();
  if (existingClient) return fn(existingClient);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await transactionContext.run(client, () => fn(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
