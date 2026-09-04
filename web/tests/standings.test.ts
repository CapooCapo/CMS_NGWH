import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { query, pool } from "../src/server/db/pool";
import { computeStandings } from "../src/server/services/standings";
import { topAssists, topScorers } from "../src/server/repositories/stats";

/**
 * REQ-TOURN-002 / REQ-TOURN-003 against the real database.
 *
 * Everything is created inside a uniquely-slugged fixture season and removed
 * afterwards, so the suite never touches or depends on existing rows.
 */
const TAG = `test-standings-${process.pid}`;
let seasonId: number;
let clubA: number;
let clubB: number;
let clubC: number;

before(async () => {
  const [season] = await query<{ id: number }>(
    `INSERT INTO seasons (slug, name_en, name_vi, status)
     VALUES ($1, 'Test Season', 'Mua test', 'active') RETURNING id`,
    [TAG]
  );
  seasonId = season.id;

  const clubs = await Promise.all(
    ["a", "b", "c"].map((suffix) =>
      query<{ id: number }>(
        `INSERT INTO clubs (slug, name, province, is_approved)
         VALUES ($1, $2, 'Testville', TRUE) RETURNING id`,
        [`${TAG}-${suffix}`, `Test Club ${suffix.toUpperCase()}`]
      )
    )
  );
  [clubA, clubB, clubC] = clubs.map((rows) => rows[0].id);

  // A beats B 80-70; A beats C 90-60; B beats C 75-70.
  //   A: PF 170 / PA 130 -> 2-0, +40
  //   B: PF 145 / PA 150 -> 1-1, -5   (70-80 away, 75-70 home)
  //   C: PF 130 / PA 165 -> 0-2, -35  (60-90 away, 70-75 away)
  // The three point differences must sum to zero.
  const fixtures: [number, number, number, number, string][] = [
    [clubA, clubB, 80, 70, "completed"],
    [clubA, clubC, 90, 60, "completed"],
    [clubB, clubC, 75, 70, "completed"],
    // A live game and a scheduled one must NOT affect standings.
    [clubB, clubA, 10, 5, "live"],
    [clubC, clubA, 0, 0, "scheduled"],
  ];
  for (const [home, away, hs, as_, status] of fixtures) {
    await query(
      `INSERT INTO matches (season_id, home_club_id, away_club_id,
         home_team_name, away_team_name, scheduled_at, status, home_score, away_score)
       VALUES ($1,$2,$3,'H','A', now(), $4, $5, $6)`,
      [seasonId, home, away, status, hs, as_]
    );
  }
});

after(async () => {
  // matches/stats cascade from seasons; clubs are referenced with ON DELETE SET NULL.
  await query("DELETE FROM seasons WHERE slug = $1", [TAG]);
  await query("DELETE FROM clubs WHERE slug LIKE $1", [`${TAG}-%`]);
  await pool.end();
});

test("standings count only completed matches", async () => {
  const table = await computeStandings(seasonId);
  assert.equal(table.length, 3);
  for (const row of table) {
    assert.equal(row.played, 2, `${row.team_name} should have 2 completed games`);
  }
});

test("standings order by wins, then point difference", async () => {
  const table = await computeStandings(seasonId);
  assert.deepEqual(
    table.map((r) => [r.team_name, r.wins, r.losses, r.point_diff]),
    [
      ["Test Club A", 2, 0, 40],
      ["Test Club B", 1, 1, -5],
      ["Test Club C", 0, 2, -35],
    ]
  );
});

test("point differences across the table sum to zero", async () => {
  const table = await computeStandings(seasonId);
  const sum = table.reduce((total, row) => total + row.point_diff, 0);
  assert.equal(sum, 0);
  assert.equal(
    table.reduce((total, row) => total + row.wins, 0),
    table.reduce((total, row) => total + row.losses, 0)
  );
});

test("standings compute points for/against from both sides of a fixture", async () => {
  const table = await computeStandings(seasonId);
  const a = table.find((r) => r.team_name === "Test Club A");
  assert.ok(a);
  assert.equal(a.points_for, 170); // 80 + 90
  assert.equal(a.points_against, 130); // 70 + 60
  assert.equal(a.win_pct, 1);
});

test("an empty season yields an empty table rather than throwing", async () => {
  const [empty] = await query<{ id: number }>(
    `INSERT INTO seasons (slug, name_en, name_vi) VALUES ($1,'E','E') RETURNING id`,
    [`${TAG}-empty`]
  );
  try {
    assert.deepEqual(await computeStandings(empty.id), []);
  } finally {
    await query("DELETE FROM seasons WHERE id = $1", [empty.id]);
  }
});

test("REQ-TOURN-003: leaders aggregate across completed matches only", async () => {
  const [match] = await query<{ id: number }>(
    `SELECT id FROM matches WHERE season_id = $1 AND status = 'completed' ORDER BY id LIMIT 1`,
    [seasonId]
  );
  const [liveMatch] = await query<{ id: number }>(
    `SELECT id FROM matches WHERE season_id = $1 AND status = 'live' LIMIT 1`,
    [seasonId]
  );

  await query(
    `INSERT INTO match_player_stats (match_id, club_id, player_name, points, assists)
     VALUES ($1,$2,'Test Player One',30,5), ($1,$2,'Test Player Two',12,11)`,
    [match.id, clubA]
  );
  // Recorded against a live match: must be excluded from season leaders.
  await query(
    `INSERT INTO match_player_stats (match_id, club_id, player_name, points, assists)
     VALUES ($1,$2,'Test Player One',99,99)`,
    [liveMatch.id, clubA]
  );

  const scorers = await topScorers(seasonId, 10);
  const assisters = await topAssists(seasonId, 10);

  assert.equal(scorers[0].player_name, "Test Player One");
  assert.equal(scorers[0].total, 30, "the live-match 99 points must be excluded");
  assert.equal(assisters[0].player_name, "Test Player Two");
  assert.equal(assisters[0].total, 11);
});
