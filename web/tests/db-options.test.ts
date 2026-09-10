import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseConnectionOptions } from "../src/server/db/options";

const CONNECTION_STRING = "postgresql://user:password@db.example.test/database";
const MULTILINE_CA = [
  "-----BEGIN CERTIFICATE-----",
  "TEST-CA-CONTENT",
  "-----END CERTIFICATE-----",
  "",
].join("\n");

test("DB_SSL=false explicitly disables PostgreSQL SSL", () => {
  const options = databaseConnectionOptions(CONNECTION_STRING, {
    DB_SSL: "false",
    DB_CA_CERT: MULTILINE_CA,
  });

  assert.equal(options.ssl, false);
});

test("DB_SSL=true uses the multiline CA with strict verification", () => {
  const options = databaseConnectionOptions(CONNECTION_STRING, {
    DB_SSL: "true",
    DB_CA_CERT: MULTILINE_CA,
  });

  assert.deepEqual(options.ssl, {
    rejectUnauthorized: true,
    ca: MULTILINE_CA,
  });
});

test("DB_SSL=true normalizes escaped newlines in the CA", () => {
  const escapedCa = MULTILINE_CA.replace(/\n/g, "\\n");
  const options = databaseConnectionOptions(CONNECTION_STRING, {
    DB_SSL: "true",
    DB_CA_CERT: escapedCa,
  });

  assert.deepEqual(options.ssl, {
    rejectUnauthorized: true,
    ca: MULTILINE_CA,
  });
});

test("DB_SSL=true fails safely when the CA is missing", () => {
  assert.throws(
    () => databaseConnectionOptions(CONNECTION_STRING, { DB_SSL: "true" }),
    /DB_CA_CERT is required when DB_SSL=true/
  );
});

test("connection-string SSL parameters cannot override the configured CA", () => {
  const options = databaseConnectionOptions(
    `${CONNECTION_STRING}?application_name=ngwh&sslmode=require`,
    { DB_SSL: "true", DB_CA_CERT: MULTILINE_CA }
  );

  assert.equal(new URL(options.connectionString!).searchParams.get("sslmode"), null);
  assert.equal(
    new URL(options.connectionString!).searchParams.get("application_name"),
    "ngwh"
  );
  assert.deepEqual(options.ssl, {
    rejectUnauthorized: true,
    ca: MULTILINE_CA,
  });
});
