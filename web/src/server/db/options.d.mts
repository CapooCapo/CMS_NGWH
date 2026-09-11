import type { PoolConfig } from "pg";

export type DatabaseEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, "DB_SSL" | "DB_CA_CERT_FILE" | "DB_CA_CERT">
>;

export function databaseConnectionOptions(
  connectionString: string,
  env?: DatabaseEnvironment
): PoolConfig;
