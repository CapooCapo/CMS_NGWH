/**
 * Seeds clearly-labelled DEMO transactional data: seasons, clubs, rosters,
 * fixtures with results, player stat lines and one live match.
 *
 *   npm run db:seed-demo
 *
 * Every row is prefixed `demo-` in its slug (or "DEMO —" in its name) so the
 * whole set can be removed with:
 *   DELETE FROM seasons     WHERE slug  LIKE 'demo-%';
 *   DELETE FROM clubs       WHERE slug  LIKE 'demo-%';
 *   DELETE FROM club_owners WHERE email LIKE 'demo-owner-%@ngwh.test';
 *
 * Idempotent: re-running updates the same rows instead of duplicating them.
 * It never touches non-demo rows.
 *
 * DEVELOPMENT ONLY. This seeds a working Club Owner login (see CLUB_OWNERS
 * below) with a known password, so it must never be run against a production
 * database — it refuses to unless DEMO_SEED_ALLOW_PRODUCTION=1 is set.
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { databaseConnectionOptions } from "../src/server/db/options.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (expected in web/.env.local).");
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && process.env.DEMO_SEED_ALLOW_PRODUCTION !== "1") {
  console.error(
    "Refusing to seed demo data (including a demo Club Owner login) with " +
      "NODE_ENV=production. Set DEMO_SEED_ALLOW_PRODUCTION=1 to override."
  );
  process.exit(1);
}

// Same scrypt parameters and hash string format as
// src/server/auth/password.ts — duplicated because this script runs under
// bare Node and cannot import the TypeScript module.
const scrypt = promisify(scryptCb);
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, {
    N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
  });
  return ["scrypt", 16384, 8, 1, salt.toString("base64"), derived.toString("base64")].join("$");
}

const client = new pg.Client(databaseConnectionOptions(url));
await client.connect();

const CLUBS = [
  ["demo-lotus-valley-titans", "DEMO — Lotus Valley Titans", "Ha Noi", 2015, true],
  ["demo-harbor-city-kestrels", "DEMO — Harbor City Kestrels", "Hai Phong", 2017, true],
  ["demo-highland-ember", "DEMO — Highland Ember", "Da Nang", 2012, true],
  ["demo-riverstone-falcons", "DEMO — Riverstone Falcons", "Can Tho", 2019, true],
  ["demo-coastal-lumen", "DEMO — Coastal Lumen", "Nha Trang", 2020, true],
  // Deliberately unapproved: proves BR-001 hides it from the public directory.
  ["demo-pending-summit-foxes", "DEMO — Summit Ridge Foxes (pending)", "Da Lat", 2021, false],
];

const clubIds = {};
for (const [slug, name, province, year, approved] of CLUBS) {
  const { rows } = await client.query(
    `INSERT INTO clubs (slug, name, province, founding_year, is_approved, approved_at,
       achievements_en, achievements_vi, contact_email, website_url, social_links)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $5 THEN now() ELSE NULL END,
       $6,$7,$8,$9,$10)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name, province = EXCLUDED.province,
       founding_year = EXCLUDED.founding_year, is_approved = EXCLUDED.is_approved,
       achievements_en = EXCLUDED.achievements_en,
       achievements_vi = EXCLUDED.achievements_vi,
       contact_email = EXCLUDED.contact_email,
       website_url = EXCLUDED.website_url,
       social_links = EXCLUDED.social_links
     RETURNING id`,
    [
      slug,
      name,
      province,
      year,
      approved,
      `DEMO CONTENT — fictional achievements for ${name}. Not an NGWH record.`,
      `NỘI DUNG DEMO — thành tích hư cấu của ${name}. Không phải hồ sơ chính thức của NGWH.`,
      `contact@${slug}.example`,
      `https://example.com/${slug}`,
      JSON.stringify({ facebook: `https://example.com/${slug}-fb` }),
    ]
  );
  clubIds[slug] = rows[0].id;
}

/*
 * Demo Club Owner logins, so the Club Owner workflow (/login → /my-club →
 * edit club, roster, coaching staff, contact & social, documents) can actually
 * be walked in development without hand-creating an account.
 *
 * Two of them on purpose: the second exists so the ownership boundary can be
 * exercised for real — signing in as owner B must never reach club A's data.
 *
 * Passwords are overridable via the environment; the defaults are fixed so the
 * fixture is deterministic. This is why the whole script refuses to run with
 * NODE_ENV=production.
 */
const CLUB_OWNERS = [
  [
    "demo-owner-titans@ngwh.test",
    process.env.DEMO_OWNER_PASSWORD ?? "demo-owner-pass-2026",
    "demo-lotus-valley-titans",
    "DEMO Nguyen Van A",
  ],
  [
    "demo-owner-kestrels@ngwh.test",
    process.env.DEMO_OWNER_B_PASSWORD ?? "demo-owner-pass-2026",
    "demo-harbor-city-kestrels",
    "DEMO Tran Thi B",
  ],
];

const ownerIdBySlug = {};
for (const [email, password, slug, fullName] of CLUB_OWNERS) {
  const hash = await hashPassword(password);
  // Looked up rather than upserted: uniqueness is an expression index on
  // LOWER(email), which ON CONFLICT cannot name as an arbiter.
  const { rows: found } = await client.query(
    "SELECT id FROM club_owners WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  let ownerId = found[0]?.id;
  if (ownerId) {
    await client.query(
      `UPDATE club_owners
          SET password_hash = $2, full_name = $3, is_active = TRUE
        WHERE id = $1`,
      [ownerId, hash, fullName]
    );
  } else {
    const { rows } = await client.query(
      `INSERT INTO club_owners (email, password_hash, full_name)
       VALUES ($1,$2,$3) RETURNING id`,
      [email, hash, fullName]
    );
    ownerId = rows[0].id;
  }
  // Release any other club this account holds first — clubs.owner_id is
  // uniquely indexed, so one owner can hold at most one club.
  await client.query(
    "UPDATE clubs SET owner_id = NULL WHERE owner_id = $1 AND id <> $2",
    [ownerId, clubIds[slug]]
  );
  await client.query("UPDATE clubs SET owner_id = $2 WHERE id = $1", [
    clubIds[slug],
    ownerId,
  ]);
  ownerIdBySlug[slug] = ownerId;
}

// Rosters (REQ-CLUB-005). Replaced wholesale on re-run so the set stays fixed.
const FIRST = ["Mai", "Linh", "Ngan", "Chau", "Thao", "Ha", "Anh", "Quyen", "Trang", "Nhi"];
const POSITIONS = ["Guard", "Guard", "Forward", "Forward", "Center"];
for (const [slug, name] of CLUBS.map((c) => [c[0], c[1]])) {
  const id = clubIds[slug];
  await client.query("DELETE FROM club_members WHERE club_id = $1", [id]);
  for (let i = 0; i < 8; i++) {
    await client.query(
      `INSERT INTO club_members (club_id, full_name, member_role, shirt_number, position, birth_year)
       VALUES ($1,$2,'player',$3,$4,$5)`,
      [id, `DEMO ${FIRST[i % FIRST.length]} ${i + 1}`, i + 4, POSITIONS[i % 5], 2006 + (i % 3)]
    );
  }
  await client.query(
    `INSERT INTO club_members (club_id, full_name, member_role, position)
     VALUES ($1,$2,'coach','Assistant coach'), ($1,$3,'staff','Physiotherapist')`,
    [id, `DEMO Coach (${name.replace("DEMO — ", "")})`, "DEMO Support Staff"]
  );
}

/*
 * The demo owners are their clubs' head coaches — the same "chủ CLB kiêm HLV
 * trưởng" shape that approving a real registration produces, so the demo data
 * exercises the actual workflow's output rather than an approximation.
 *
 * Runs after the roster loop above, which deletes and rebuilds every member.
 */
for (const [, , slug, fullName] of CLUB_OWNERS) {
  const ownerId = ownerIdBySlug[slug];
  if (!ownerId) continue;
  await client.query(
    `INSERT INTO club_members
       (club_id, full_name, member_role, position, club_owner_id, is_head_coach)
     VALUES ($1, $2, 'coach', 'Head coach', $3, TRUE)`,
    [clubIds[slug], fullName, ownerId]
  );
}

const SEASONS = [
  ["demo-season-2026", "DEMO — NGWH U20 Season 2026", "DEMO — Giải U20 NGWH 2026", "2026-06-01", "2026-09-30", "active"],
  ["demo-season-2025", "DEMO — NGWH U20 Season 2025", "DEMO — Giải U20 NGWH 2025", "2025-06-01", "2025-09-30", "completed"],
  ["demo-season-2027", "DEMO — NGWH U20 Season 2027", "DEMO — Giải U20 NGWH 2027", "2027-06-01", "2027-09-30", "upcoming"],
];
const seasonIds = {};
for (const [slug, en, vi, starts, ends, status] of SEASONS) {
  const { rows } = await client.query(
    `INSERT INTO seasons (slug, name_en, name_vi, starts_on, ends_on, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (slug) DO UPDATE SET
       name_en = EXCLUDED.name_en, name_vi = EXCLUDED.name_vi,
       starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on,
       status = EXCLUDED.status
     RETURNING id`,
    [slug, en, vi, starts, ends, status]
  );
  seasonIds[slug] = rows[0].id;
}

// Fixtures. Rebuilt each run so scores stay deterministic.
const active = seasonIds["demo-season-2026"];
const past = seasonIds["demo-season-2025"];
await client.query("DELETE FROM matches WHERE season_id = ANY($1)", [
  Object.values(seasonIds),
]);

const c = (slug) => clubIds[slug];
const day = (offsetDays, hour) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** [season, home, away, whenISO, status, homeScore, awayScore, period] */
const FIXTURES = [
  // Completed results in the active season — these drive standings.
  [active, "demo-lotus-valley-titans", "demo-harbor-city-kestrels", day(-21, 11), "completed", 68, 66, null],
  [active, "demo-highland-ember", "demo-riverstone-falcons", day(-18, 13), "completed", 74, 59, null],
  [active, "demo-lotus-valley-titans", "demo-highland-ember", day(-14, 11), "completed", 71, 77, null],
  [active, "demo-harbor-city-kestrels", "demo-coastal-lumen", day(-11, 15), "completed", 83, 70, null],
  [active, "demo-riverstone-falcons", "demo-coastal-lumen", day(-7, 13), "completed", 64, 61, null],
  [active, "demo-highland-ember", "demo-harbor-city-kestrels", day(-4, 11), "completed", 80, 72, null],
  // One live match — exercises REQ-HOME-005 and the operator console.
  [active, "demo-lotus-valley-titans", "demo-riverstone-falcons", day(0, 10), "live", 42, 39, "Q3"],
  // Upcoming fixtures — the schedule view.
  [active, "demo-coastal-lumen", "demo-lotus-valley-titans", day(4, 12), "scheduled", 0, 0, null],
  [active, "demo-harbor-city-kestrels", "demo-riverstone-falcons", day(8, 14), "scheduled", 0, 0, null],
  [active, "demo-highland-ember", "demo-coastal-lumen", day(12, 16), "scheduled", 0, 0, null],
  // Archived season (REQ-TOURN-004).
  [past, "demo-highland-ember", "demo-lotus-valley-titans", "2025-08-20T11:00:00Z", "completed", 79, 75, null],
  [past, "demo-harbor-city-kestrels", "demo-riverstone-falcons", "2025-08-22T11:00:00Z", "completed", 66, 70, null],
];

const matchIds = [];
for (const [season, home, away, when, status, hs, as_, period] of FIXTURES) {
  const { rows } = await client.query(
    `INSERT INTO matches (season_id, home_club_id, away_club_id, home_team_name,
       away_team_name, venue, scheduled_at, status, home_score, away_score, period)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      season,
      c(home),
      c(away),
      CLUBS.find((x) => x[0] === home)[1],
      CLUBS.find((x) => x[0] === away)[1],
      "DEMO Arena",
      when,
      status,
      hs,
      as_,
      period,
    ]
  );
  matchIds.push({ id: rows[0].id, home: c(home), away: c(away), status });
}

// Player stat lines for completed matches (REQ-TOURN-003: points + assists only).
let seed = 7;
const rand = (n) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};
for (const match of matchIds.filter((m) => m.status === "completed")) {
  for (const clubId of [match.home, match.away]) {
    const { rows: roster } = await client.query(
      "SELECT full_name FROM club_members WHERE club_id = $1 AND member_role = 'player' ORDER BY id LIMIT 5",
      [clubId]
    );
    for (const player of roster) {
      await client.query(
        `INSERT INTO match_player_stats (match_id, club_id, player_name, points, assists)
         VALUES ($1,$2,$3,$4,$5)`,
        [match.id, clubId, player.full_name, 4 + rand(22), rand(9)]
      );
    }
  }
}

// A pending registration so the BR-001 approval workflow has something to act on.
await client.query(
  `INSERT INTO club_registrations (club_name, operating_region, representative_name,
     representative_email, representative_phone, notes)
   SELECT 'DEMO — Delta Bay Herons', 'Vinh Long', 'DEMO Representative',
          'demo-representative@example.test', '+84 90 000 0000',
          'DEMO CONTENT — a fictional submission for testing the approval workflow.'
   WHERE NOT EXISTS (
     SELECT 1 FROM club_registrations WHERE club_name = 'DEMO — Delta Bay Herons'
   )`
);

// A contact message so the inbox is not empty.
await client.query(
  `INSERT INTO contact_messages (name, email, subject, message, locale)
   SELECT 'DEMO Sender', 'demo-sender@example.test', 'DEMO — sample enquiry',
          'DEMO CONTENT — this is a sample contact submission used for testing.', 'en'
   WHERE NOT EXISTS (
     SELECT 1 FROM contact_messages WHERE email = 'demo-sender@example.test'
   )`
);

const counts = await client.query(
  `SELECT
     (SELECT COUNT(*) FROM clubs WHERE slug LIKE 'demo-%')::int AS clubs,
     (SELECT COUNT(*) FROM club_members)::int AS members,
     (SELECT COUNT(*) FROM seasons WHERE slug LIKE 'demo-%')::int AS seasons,
     (SELECT COUNT(*) FROM matches)::int AS matches,
     (SELECT COUNT(*) FROM match_player_stats)::int AS stats,
     (SELECT COUNT(*) FROM club_registrations)::int AS registrations,
     (SELECT COUNT(*) FROM contact_messages)::int AS messages,
     (SELECT COUNT(*) FROM club_owners WHERE email LIKE 'demo-owner-%@ngwh.test')::int AS clubOwners`
);
console.log("Demo data seeded:", counts.rows[0]);
console.log(
  "Demo Club Owner logins (development only) — sign in at /login:\n" +
    CLUB_OWNERS.map(([email, , slug]) => `  ${email}  →  /clubs/${slug}`).join("\n")
);
await client.end();
