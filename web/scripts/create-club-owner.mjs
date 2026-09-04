/**
 * Creates (or resets the password of) a Club Owner account and links it to one
 * club. The operational counterpart to `create-admin.mjs` for the *other*
 * principal kind — a club owner is scoped to exactly one club and is never
 * staff-privileged (see migration 005).
 *
 *   npm run owner:create -- --email owner@club.example --club demo-lotus-valley-titans
 *
 * The club is named by **slug**, not id: a slug is stable and human-checkable,
 * so an operator cannot silently link an account to the wrong club by
 * mistyping a number.
 *
 * Environment-variable bootstrap (unattended: CI, Docker, first deploy):
 *
 *   CLUB_OWNER_EMAIL=owner@club.example \
 *   CLUB_OWNER_PASSWORD=... \
 *   CLUB_OWNER_CLUB=demo-lotus-valley-titans \
 *     npm run owner:create
 *
 * As in `create-admin.mjs`, the password is only ever read from the
 * environment or an echo-disabled prompt — never from argv (visible in `ps`),
 * never written to a file, never logged.
 *
 * Ownership invariants match `repositories/clubOwners.ts` exactly, and are
 * enforced here in one transaction with `SELECT … FOR UPDATE`:
 *  - a club has at most one owner, and this script never silently steals a
 *    club from an existing owner (pass `--reassign` to do that deliberately);
 *  - re-running for the same email + same club resets that account's password
 *    rather than creating a duplicate, so the command is idempotent.
 */
import { createInterface } from "node:readline";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, KEYLEN = 64, MAXMEM = 64 * 1024 * 1024;

// Duplicated from src/server/auth/password.ts for the same reason
// create-admin.mjs duplicates it: this runs under bare Node, before a build,
// so it cannot import the TypeScript module.
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

const email = arg("email", process.env.CLUB_OWNER_EMAIL || null);
const clubSlug = arg("club", process.env.CLUB_OWNER_CLUB || null);
const reassign = process.argv.includes("--reassign");

if (!email || !clubSlug) {
  console.error(
    "Usage: npm run owner:create -- --email <address> --club <club-slug> [--reassign]"
  );
  process.exit(1);
}
// Deliberately loose: the authoritative check is `Validator.email` on the
// admin API route. This only catches an obviously wrong argument order.
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`"${email}" does not look like an email address.`);
  process.exit(1);
}

let password = process.env.CLUB_OWNER_PASSWORD;
if (!password) {
  if (!process.stdin.isTTY) {
    console.error(
      "Set CLUB_OWNER_PASSWORD, or run this in an interactive terminal."
    );
    process.exit(1);
  }
  password = await promptHidden(`Password for "${email}": `);
  const again = await promptHidden("Repeat password: ");
  const a = Buffer.from(password), b = Buffer.from(again);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.error("Passwords did not match.");
    process.exit(1);
  }
}
// Same 10-character minimum the admin "assign club owner" endpoint enforces.
if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const hash = await hashPassword(password);
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("BEGIN");

  const { rows: clubRows } = await client.query(
    "SELECT id, name, owner_id FROM clubs WHERE slug = $1 FOR UPDATE",
    [clubSlug]
  );
  const club = clubRows[0];
  if (!club) {
    throw new Error(`No club with slug "${clubSlug}".`);
  }

  // Looked up explicitly rather than via ON CONFLICT: the uniqueness rule is
  // an expression index on LOWER(email), which ON CONFLICT cannot name as an
  // arbiter. Both branches run inside this transaction, so a concurrent
  // create still fails on the index rather than producing a duplicate.
  const { rows: existing } = await client.query(
    "SELECT id, email FROM club_owners WHERE LOWER(email) = LOWER($1)",
    [email]
  );

  let owner = existing[0];
  if (owner) {
    // Existing account: reset its password and reactivate it. This is what
    // makes the command double as a password reset.
    await client.query(
      "UPDATE club_owners SET password_hash = $2, is_active = TRUE WHERE id = $1",
      [owner.id, hash]
    );
  } else {
    const { rows: created } = await client.query(
      `INSERT INTO club_owners (email, password_hash) VALUES ($1, $2)
       RETURNING id, email`,
      [email, hash]
    );
    owner = created[0];
  }

  if (club.owner_id && club.owner_id !== owner.id && !reassign) {
    throw new Error(
      `Club "${clubSlug}" already has a different owner (id ${club.owner_id}). ` +
        "Re-run with --reassign to move ownership deliberately."
    );
  }

  // A club_owner may own at most one club (unique index on clubs.owner_id):
  // release any other club this account currently owns before taking this one.
  await client.query(
    "UPDATE clubs SET owner_id = NULL WHERE owner_id = $1 AND id <> $2",
    [owner.id, club.id]
  );
  await client.query("UPDATE clubs SET owner_id = $2 WHERE id = $1", [
    club.id,
    owner.id,
  ]);

  await client.query("COMMIT");
  console.log("Club Owner account ready:", {
    id: owner.id,
    email: owner.email,
    club: club.name,
    clubSlug,
  });
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
