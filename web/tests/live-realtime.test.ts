import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { databaseConnectionOptions } from "../src/server/db/options";
import { query, pool } from "../src/server/db/pool";
import { applyLiveMatchUpdate, shouldApplyLiveRevision, type LiveFeed } from "../src/lib/liveFeed";
import { parseScoreAdjustment } from "../src/server/validation/admin";
import {
  adjustLiveMatch,
  LIVE_MATCH_CHANNEL,
  updateLiveScore,
} from "../src/server/services/liveMatchUpdates";
import type { MatchWithContext } from "../src/server/repositories/types";

const TAG = `test-live-realtime-${process.pid}`;
let seasonId: number;
let matchId: number;
let listener: Client;
let notificationsSupported = false;

function notification(timeout = 1_000) {
  return new Promise<{ matchId: number; revision: number } | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout);
    listener.once("notification", (message) => {
      clearTimeout(timer);
      resolve(JSON.parse(message.payload ?? "{}") as { matchId: number; revision: number });
    });
  });
}

before(async () => {
  const [season] = await query<{ id: number }>(
    `INSERT INTO seasons (slug, name_en, name_vi, status)
     VALUES ($1, 'Realtime test', 'Realtime test', 'active') RETURNING id`,
    [TAG]
  );
  seasonId = season.id;
  const [match] = await query<{ id: number }>(
    `INSERT INTO matches (season_id, home_team_name, away_team_name, scheduled_at, status)
     VALUES ($1, 'Home', 'Away', now(), 'live') RETURNING id`,
    [seasonId]
  );
  matchId = match.id;
  listener = new Client(databaseConnectionOptions(process.env.DATABASE_URL!));
  await listener.connect();
  await listener.query(`LISTEN ${LIVE_MATCH_CHANNEL}`);
  // Some managed/pooler endpoints accept LISTEN but do not forward NOTIFY
  // messages between connections. Probe that capability directly so this
  // integration suite does not misreport an infrastructure limitation as an
  // application regression.
  const received = notification();
  await query("SELECT pg_notify($1, $2)", [
    LIVE_MATCH_CHANNEL,
    JSON.stringify({ matchId: 0, revision: 0 }),
  ]);
  notificationsSupported = (await received)?.matchId === 0;
});

after(async () => {
  await listener.end();
  await query("DELETE FROM seasons WHERE id = $1", [seasonId]);
  await pool.end();
});

test("committed score updates increment revision and publish one match notification", async (t) => {
  const received = notificationsSupported ? notification() : null;
  const update = await updateLiveScore(matchId, 44, 39, "live", "Q3");
  assert.ok(update);
  assert.equal(update.match.live_revision, 1);
  assert.equal(update.match.home_score, 44);
  assert.equal(update.match.home_fouls, 0);
  assert.equal(update.match.away_fouls, 0);
  assert.deepEqual(update.before, {
    homeScore: 0,
    awayScore: 0,
    homeFouls: 0,
    awayFouls: 0,
    status: "live",
  });
  assert.deepEqual(update.after, {
    homeScore: 44,
    awayScore: 39,
    homeFouls: 0,
    awayFouls: 0,
    status: "live",
  });
  if (!received) return t.skip("configured PostgreSQL endpoint does not forward LISTEN/NOTIFY");
  assert.deepEqual(await received, { matchId, revision: 1 });
});

test("a failed score mutation rolls back without a public notification", async () => {
  const received = notification(300);
  await assert.rejects(() => updateLiveScore(matchId, -1, 39, "live", "Q3"));
  assert.equal(await received, null);
  const [row] = await query<{ home_score: number; live_revision: number }>(
    "SELECT home_score, live_revision FROM matches WHERE id = $1",
    [matchId]
  );
  assert.deepEqual(row, { home_score: 44, live_revision: 1 });
});

test("all supported score deltas are atomic and concurrent clicks lose no points", async () => {
  const increments = await Promise.all(
    [1, 1, 1, 2, 3].map((delta) => adjustLiveMatch(matchId, "home", "score", delta))
  );
  assert.ok(increments.every((result) => result.match && !result.scoreRejected));
  const homeDown = await adjustLiveMatch(matchId, "home", "score", -3);
  const awayChanges = await Promise.all(
    [-1, -2, 3].map((delta) => adjustLiveMatch(matchId, "away", "score", delta))
  );
  assert.equal(homeDown.match?.home_score, 49);
  assert.ok(awayChanges.every((result) => result.match));
  const [row] = await query<{ home_score: number; away_score: number; live_revision: number }>(
    "SELECT home_score, away_score, live_revision FROM matches WHERE id = $1",
    [matchId]
  );
  assert.deepEqual(row, { home_score: 49, away_score: 39, live_revision: 10 });
});

test("team fouls use the same revision/event path and cannot become negative", async (t) => {
  const rejected = await adjustLiveMatch(matchId, "home", "foul", -1);
  assert.deepEqual(rejected, { match: null, scoreRejected: true });

  const received = notificationsSupported ? notification() : null;
  const homeUp = await adjustLiveMatch(matchId, "home", "foul", 1);
  assert.equal(homeUp.match?.home_fouls, 1);
  assert.equal(homeUp.match?.away_fouls, 0);
  if (!received) return t.skip("configured PostgreSQL endpoint does not forward LISTEN/NOTIFY");
  assert.deepEqual(await received, { matchId, revision: 11 });

  const awayUp = await adjustLiveMatch(matchId, "away", "foul", 1);
  const homeDown = await adjustLiveMatch(matchId, "home", "foul", -1);
  assert.equal(awayUp.match?.away_fouls, 1);
  assert.equal(homeDown.match?.home_fouls, 0);
  const [row] = await query<{
    home_fouls: number;
    away_fouls: number;
    live_revision: number;
  }>("SELECT home_fouls, away_fouls, live_revision FROM matches WHERE id = $1", [matchId]);
  assert.deepEqual(row, { home_fouls: 0, away_fouls: 1, live_revision: 13 });
});

test("score and foul adjustment payloads accept only their documented deltas", () => {
  assert.deepEqual(parseScoreAdjustment({ team: "home", kind: "score", delta: 3 }), {
    team: "home",
    kind: "score",
    delta: 3,
  });
  assert.deepEqual(parseScoreAdjustment({ team: "away", kind: "foul", delta: -1 }), {
    team: "away",
    kind: "foul",
    delta: -1,
  });
  for (const input of [
    { team: "home", kind: "score", delta: 0 },
    { team: "home", kind: "score", delta: 4 },
    { team: "away", kind: "foul", delta: 2 },
    { team: "foo", kind: "score", delta: 1 },
  ]) {
    assert.throws(() => parseScoreAdjustment(input));
  }
});

function match(id: number, status: MatchWithContext["status"], revision: number): MatchWithContext {
  return {
    id,
    season_id: 1,
    home_club_id: null,
    away_club_id: null,
    home_team_name: `Home ${id}`,
    away_team_name: `Away ${id}`,
    venue: null,
    scheduled_at: "2099-01-01T10:00:00Z",
    status,
    home_score: 0,
    away_score: 0,
    home_fouls: 0,
    away_fouls: 0,
    period: null,
    live_revision: revision,
    season_slug: "test",
    season_name_en: "Test",
    season_name_vi: "Test",
    home_club_slug: null,
    away_club_slug: null,
    home_club_logo: null,
    away_club_logo: null,
  };
}

test("feed reducer changes only the affected match and moves it by status", () => {
  const matchA = match(1, "live", 3);
  const matchB = match(2, "live", 2);
  const feed: LiveFeed = {
    live: [matchA, matchB],
    recent: [],
    upcoming: [],
    fetchedAt: "2026-01-01T00:00:00Z",
  };
  const completedA = { ...matchA, status: "completed" as const, home_score: 50, live_revision: 4 };
  const next = applyLiveMatchUpdate(feed, completedA);
  assert.deepEqual(next.live.map((item) => item.id), [2]);
  assert.deepEqual(next.recent.map((item) => [item.id, item.home_score]), [[1, 50]]);
  assert.equal(next.live[0], matchB);
});

test("older revisions cannot overwrite a newer live state", () => {
  assert.equal(shouldApplyLiveRevision(7, 6), false);
  assert.equal(shouldApplyLiveRevision(7, 7), false);
  assert.equal(shouldApplyLiveRevision(7, 8), true);
});
