/**
 * Creates or resets a staff account. This is the project's bootstrap path —
 * there is no runtime schema-init hook; migrations create the schema and this
 * script seeds the first account.
 *
 *   npm run admin:create -- --username admin --role superadmin
 *
 * Environment-variable bootstrap (unattended: CI, Docker, first deploy):
 *
 *   ADMIN_BOOTSTRAP=admin \
 *   ADMIN_BOOTSTRAP_PASSWORD=... \
 *   ADMIN_BOOTSTRAP_ROLE=superadmin \
 *   ADMIN_BOOTSTRAP_EMAIL=ops@example.com \
 *     npm run admin:create
 *
 * `ADMIN_BOOTSTRAP` names the account; flags override it when both are given.
 * `ADMIN_PASSWORD` remains supported as an alias of
 * `ADMIN_BOOTSTRAP_PASSWORD`.
 *
 * The password is only ever read from the environment or an echo-disabled
 * prompt — never from argv (argv is visible in `ps`) and never written to a
 * file, so no credential can end up in source control. Values are not logged.
 */
import { createInterface } from "node:readline";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { databaseConnectionOptions } from "../src/server/db/options.mjs";

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, KEYLEN = 64, MAXMEM = 64 * 1024 * 1024;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), derived.toString("base64")].join("$");
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdout = process.stdout;
    const onData = (char) => {
      // Re-render the prompt without the typed characters.
      if (char.toString() !== "\r" && char.toString() !== "\n") {
        stdout.clearLine?.(0);
        stdout.cursorTo?.(0);
        stdout.write(question);
      }
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      process.stdin.off("data", onData);
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
  });
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (expected in web/.env.local).");
  process.exit(1);
}

/*
 * Role set duplicated as a plain array on purpose: this script runs under bare
 * Node before the app is built, so it cannot import the TypeScript module in
 * src/server/auth/permissions.ts. The database CHECK constraint added in
 * migration 003 is the backstop if the two ever drift.
 */
const ROLES = ["superadmin", "admin", "editor", "operator", "subadmin"];

// Flags win over env vars, so an operator can override a baked-in bootstrap.
const username = arg("username", process.env.ADMIN_BOOTSTRAP || "admin");
const role = arg("role", process.env.ADMIN_BOOTSTRAP_ROLE || "admin");
const email = arg("email", process.env.ADMIN_BOOTSTRAP_EMAIL || null);

if (!ROLES.includes(role)) {
  console.error(`Invalid role "${role}". Use one of: ${ROLES.join(", ")}.`);
  process.exit(1);
}

let password =
  process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.ADMIN_PASSWORD;
if (!password) {
  if (!process.stdin.isTTY) {
    console.error(
      "Set ADMIN_BOOTSTRAP_PASSWORD (or ADMIN_PASSWORD), or run this in an " +
        "interactive terminal."
    );
    process.exit(1);
  }
  password = await promptHidden(`Password for "${username}": `);
  const again = await promptHidden("Repeat password: ");
  const a = Buffer.from(password), b = Buffer.from(again);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.error("Passwords did not match.");
    process.exit(1);
  }
}
if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const client = new pg.Client(databaseConnectionOptions(url));
await client.connect();

/*
 * Unattended bootstrap must be safe to run on every deploy, so when the
 * account already exists and no flags were passed, leave it alone rather than
 * resetting a live password. An explicit `--username` (an operator typing the
 * command) still resets, which is what makes this double as a password reset.
 */
const explicit = process.argv.includes("--username");
if (!explicit && process.env.ADMIN_BOOTSTRAP) {
  const { rows } = await client.query(
    "SELECT id, username, role, is_active FROM admin_users WHERE LOWER(username) = LOWER($1)",
    [username]
  );
  if (rows.length > 0) {
    console.log("Bootstrap account already exists; leaving it unchanged:", rows[0]);
    await client.end();
    process.exit(0);
  }
}

const hash = await hashPassword(password);
const { rows } = await client.query(
  `INSERT INTO admin_users (username, email, password_hash, role)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (username) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         email = COALESCE(EXCLUDED.email, admin_users.email),
         is_active = TRUE
   RETURNING id, username, role, is_active`,
  [username, email, hash, role]
);
console.log("Staff account ready:", rows[0]);
await client.end();
