import "server-only";

// The implementation is plain ESM so bare-Node operational scripts can reuse
// the exact same TLS policy without a TypeScript runtime loader.
export { databaseConnectionOptions } from "./options.mjs";
export type { DatabaseEnvironment } from "./options.mjs";
