import "server-only";
import type { PoolConfig } from "pg";

/** Shared PostgreSQL settings for every long-lived application connection. */
export function databaseConnectionOptions(connectionString: string): PoolConfig {
  return {
    connectionString,
    // Omitting ssl locally leaves a connection-string SSL mode intact (some
    // managed development databases require it); DB_SSL=true is the explicit
    // production policy and always verifies the provider certificate.
    ...(process.env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}
