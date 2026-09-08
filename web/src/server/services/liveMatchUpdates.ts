import "server-only";
import type { QueryResultRow } from "pg";
import { transaction } from "@/server/db/pool";
import type { MatchInput } from "@/server/repositories/matches";
import type {
  AdminAuditMatchState,
  AdminAuditMetadata,
} from "@/server/repositories/adminAuditLogs";
import type { MatchStatus, MatchWithContext } from "@/server/repositories/types";

export const LIVE_MATCH_CHANNEL = "ngwh_match_updates";

const CONTEXT_COLUMNS = `
  u.id, u.season_id, u.home_club_id, u.away_club_id,
  u.home_team_name, u.away_team_name, u.venue,
  to_char(u.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS scheduled_at,
  u.status, u.home_score, u.away_score, u.home_fouls, u.away_fouls,
  u.period, u.live_revision,
  s.slug AS season_slug, s.name_en AS season_name_en, s.name_vi AS season_name_vi,
  hc.slug AS home_club_slug, ac.slug AS away_club_slug,
  hc.logo_url AS home_club_logo, ac.logo_url AS away_club_logo`;

const BEFORE_STATE_COLUMNS = `
  c.home_score AS before_home_score, c.away_score AS before_away_score,
  c.home_fouls AS before_home_fouls, c.away_fouls AS before_away_fouls,
  c.status AS before_status`;

type MatchRowWithBefore = MatchWithContext & {
  before_home_score: number;
  before_away_score: number;
  before_home_fouls: number;
  before_away_fouls: number;
  before_status: MatchStatus;
};

export type MatchAuditState = {
  homeScore: number;
  awayScore: number;
  homeFouls: number;
  awayFouls: number;
  status: MatchStatus;
};

export type LiveMatchMutation = {
  match: MatchWithContext;
  before: MatchAuditState;
  after: MatchAuditState;
};

async function notifyCommittedMatch(
  client: import("pg").PoolClient,
  match: MatchWithContext
) {
  // PostgreSQL holds NOTIFY until this transaction commits. If this call fails,
  // the surrounding transaction rolls back and no false public event exists.
  await client.query("SELECT pg_notify($1, $2)", [
    LIVE_MATCH_CHANNEL,
    JSON.stringify({ matchId: match.id, revision: match.live_revision }),
  ]);
}

async function updateAndPublish(
  sql: string,
  params: readonly unknown[]
): Promise<LiveMatchMutation | null> {
  return transaction(async (client) => {
    const result = await client.query<MatchRowWithBefore & QueryResultRow>(sql, params as unknown[]);
    const row = result.rows[0] ?? null;
    if (!row) return null;
    const mutation: LiveMatchMutation = {
      match: row,
      before: {
        homeScore: row.before_home_score,
        awayScore: row.before_away_score,
        homeFouls: row.before_home_fouls,
        awayFouls: row.before_away_fouls,
        status: row.before_status,
      },
      after: {
        homeScore: row.home_score,
        awayScore: row.away_score,
        homeFouls: row.home_fouls,
        awayFouls: row.away_fouls,
        status: row.status,
      },
    };
    await notifyCommittedMatch(client, mutation.match);
    return mutation;
  });
}

/**
 * Allowlisted score/result detail for an audit event. Score snapshots always
 * contain both sides so a reader can understand the game state; foul-only
 * updates contain only the changed foul count.
 */
export function scoreAuditMetadata(
  before: MatchAuditState,
  after: MatchAuditState,
  { includeUnchangedScore = false }: { includeUnchangedScore?: boolean } = {}
): AdminAuditMetadata | null {
  const changedFields = [
    ...(before.homeScore !== after.homeScore ? ["homeScore"] : []),
    ...(before.awayScore !== after.awayScore ? ["awayScore"] : []),
    ...(before.homeFouls !== after.homeFouls ? ["homeFouls"] : []),
    ...(before.awayFouls !== after.awayFouls ? ["awayFouls"] : []),
    ...(before.status !== after.status ? ["status"] : []),
  ];
  const scoreChanged =
    before.homeScore !== after.homeScore || before.awayScore !== after.awayScore;
  const foulChanged =
    before.homeFouls !== after.homeFouls || before.awayFouls !== after.awayFouls;
  const statusChanged = before.status !== after.status;
  if (!scoreChanged && !foulChanged && !statusChanged && !includeUnchangedScore) return null;

  const beforeMetadata: AdminAuditMatchState = {};
  const afterMetadata: AdminAuditMatchState = {};
  if (scoreChanged || includeUnchangedScore) {
    beforeMetadata.homeScore = before.homeScore;
    beforeMetadata.awayScore = before.awayScore;
    afterMetadata.homeScore = after.homeScore;
    afterMetadata.awayScore = after.awayScore;
  }
  if (before.homeFouls !== after.homeFouls) {
    beforeMetadata.homeFouls = before.homeFouls;
    afterMetadata.homeFouls = after.homeFouls;
  }
  if (before.awayFouls !== after.awayFouls) {
    beforeMetadata.awayFouls = before.awayFouls;
    afterMetadata.awayFouls = after.awayFouls;
  }
  if (statusChanged) {
    beforeMetadata.status = before.status;
    afterMetadata.status = after.status;
  }
  return { changedFields, before: beforeMetadata, after: afterMetadata };
}

/** Full fixture edits still publish when the public match representation changes. */
export function updateLiveMatch(id: number, input: MatchInput) {
  return updateAndPublish(
    `WITH current AS (
       SELECT id, home_score, away_score, home_fouls, away_fouls, status
       FROM matches WHERE id=$1 FOR UPDATE
     ), u AS (
       UPDATE matches AS m SET season_id=$2, home_club_id=$3, away_club_id=$4,
         home_team_name=$5, away_team_name=$6, venue=$7, scheduled_at=$8,
         status=$9, home_score=$10, away_score=$11, period=$12,
         live_revision = live_revision + 1
       FROM current c WHERE m.id = c.id
       RETURNING m.*
     )
     SELECT ${CONTEXT_COLUMNS}, ${BEFORE_STATE_COLUMNS}
       FROM u
       JOIN current c ON c.id = u.id
       JOIN seasons s ON s.id = u.season_id
       LEFT JOIN clubs hc ON hc.id = u.home_club_id
       LEFT JOIN clubs ac ON ac.id = u.away_club_id`,
    [
      id,
      input.seasonId,
      input.homeClubId,
      input.awayClubId,
      input.homeTeamName,
      input.awayTeamName,
      input.venue,
      input.scheduledAt,
      input.status,
      input.homeScore,
      input.awayScore,
      input.period,
    ]
  );
}

/** The scoreboard's restricted mid-game mutation path. */
export function updateLiveScore(
  id: number,
  homeScore: number,
  awayScore: number,
  status: MatchStatus,
  period: string | null
) {
  return updateAndPublish(
    `WITH current AS (
       SELECT id, home_score, away_score, home_fouls, away_fouls, status
       FROM matches WHERE id=$1 FOR UPDATE
     ), u AS (
       UPDATE matches AS m SET home_score=$2, away_score=$3, status=$4, period=$5,
         live_revision = live_revision + 1
       FROM current c WHERE m.id = c.id
       RETURNING m.*
     )
     SELECT ${CONTEXT_COLUMNS}, ${BEFORE_STATE_COLUMNS}
       FROM u
       JOIN current c ON c.id = u.id
       JOIN seasons s ON s.id = u.season_id
       LEFT JOIN clubs hc ON hc.id = u.home_club_id
       LEFT JOIN clubs ac ON ac.id = u.away_club_id`,
    [id, homeScore, awayScore, status, period]
  );
}

export type MatchTeam = "home" | "away";
export type LiveAdjustmentKind = "score" | "foul";

/**
 * Atomic score/foul control used by the live console. PostgreSQL evaluates the
 * expression, so concurrent clicks cannot overwrite one another. A rejected
 * decrement deliberately does not increment the revision or queue a notice.
 */
export async function adjustLiveMatch(
  id: number,
  team: MatchTeam,
  kind: LiveAdjustmentKind,
  delta: number
) {
  const column =
    kind === "score"
      ? team === "home" ? "home_score" : "away_score"
      : team === "home" ? "home_fouls" : "away_fouls";
  return transaction(async (client) => {
    const result = await client.query<MatchRowWithBefore & QueryResultRow>(
      `WITH current AS (
         SELECT id, home_score, away_score, home_fouls, away_fouls, status
         FROM matches WHERE id=$1 FOR UPDATE
       ), u AS (
         UPDATE matches AS m SET ${column} = m.${column} + $2,
           live_revision = live_revision + 1
         FROM current c
         WHERE m.id = c.id AND c.${column} + $2 >= 0
         RETURNING m.*
       )
       SELECT ${CONTEXT_COLUMNS}, ${BEFORE_STATE_COLUMNS}
         FROM u
         JOIN current c ON c.id = u.id
         JOIN seasons s ON s.id = u.season_id
         LEFT JOIN clubs hc ON hc.id = u.home_club_id
         LEFT JOIN clubs ac ON ac.id = u.away_club_id`,
      [id, delta]
    );
    const row = result.rows[0] ?? null;
    if (row) {
      const mutation: LiveMatchMutation = {
        match: row,
        before: {
          homeScore: row.before_home_score,
          awayScore: row.before_away_score,
          homeFouls: row.before_home_fouls,
          awayFouls: row.before_away_fouls,
          status: row.before_status,
        },
        after: {
          homeScore: row.home_score,
          awayScore: row.away_score,
          homeFouls: row.home_fouls,
          awayFouls: row.away_fouls,
          status: row.status,
        },
      };
      await notifyCommittedMatch(client, mutation.match);
      return { ...mutation, scoreRejected: false };
    }
    const exists = await client.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM matches WHERE id = $1) AS exists",
      [id]
    );
    return { match: null, scoreRejected: exists.rows[0]?.exists === true };
  });
}
