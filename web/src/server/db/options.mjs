import { existsSync, readFileSync } from "node:fs";

const SSL_CONNECTION_PARAMETERS = [
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
];

const RENDER_DB_CA_CERT_FILE = "/etc/secrets/DB_CA_CERT";

function readCaFile(filePath, label) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`Unable to read PostgreSQL CA certificate from ${label}.`);
  }
}

function readDatabaseCa(env) {
  const explicitFile = env.DB_CA_CERT_FILE?.trim();
  if (explicitFile) return readCaFile(explicitFile, "DB_CA_CERT_FILE");

  if (existsSync(RENDER_DB_CA_CERT_FILE)) {
    return readCaFile(RENDER_DB_CA_CERT_FILE, "Render Secret File");
  }

  return env.DB_CA_CERT?.replace(/\\n/g, "\n");
}

/**
 * Remove connection-string SSL settings when DB_SSL explicitly owns the TLS
 * policy. node-postgres parses `connectionString` after the surrounding
 * config object, so an `sslmode` query parameter would otherwise replace the
 * strict `ssl` object (including its CA).
 */
function withoutConnectionStringSslOptions(connectionString) {
  try {
    const url = new URL(connectionString);
    for (const parameter of SSL_CONNECTION_PARAMETERS) {
      url.searchParams.delete(parameter);
    }
    return url.toString();
  } catch {
    // Let node-postgres produce its normal connection-string error later.
    return connectionString;
  }
}

/** Shared PostgreSQL settings for application, realtime, and script clients. */
export function databaseConnectionOptions(connectionString, env = process.env) {
  if (env.DB_SSL === "true") {
    const ca = readDatabaseCa(env);
    if (!ca?.trim()) {
      throw new Error(
        "A PostgreSQL CA certificate is required when DB_SSL=true. " +
        "Set DB_CA_CERT_FILE, provide /etc/secrets/DB_CA_CERT, or set DB_CA_CERT."
      );
    }

    return {
      connectionString: withoutConnectionStringSslOptions(connectionString),
      ssl: {
        rejectUnauthorized: true,
        ca,
      },
    };
  }

  return {
    connectionString: withoutConnectionStringSslOptions(connectionString),
    ssl: false,
  };
}
