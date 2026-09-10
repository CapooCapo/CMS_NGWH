const SSL_CONNECTION_PARAMETERS = [
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
];

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
    const ca = env.DB_CA_CERT?.replace(/\\n/g, "\n");
    if (!ca?.trim()) {
      throw new Error("DB_CA_CERT is required when DB_SSL=true.");
    }

    return {
      connectionString: withoutConnectionStringSslOptions(connectionString),
      ssl: {
        rejectUnauthorized: true,
        ca,
      },
    };
  }

  if (env.DB_SSL === "false") {
    return {
      connectionString: withoutConnectionStringSslOptions(connectionString),
      ssl: false,
    };
  }

  // Preserve the previous behavior when DB_SSL is unspecified: node-postgres
  // may still honor SSL settings embedded in DATABASE_URL or its own defaults.
  return { connectionString };
}
