import "server-only";
import type { QueryResultRow } from "pg";
import { transaction } from "@/server/db/pool";
import type { MatchInput } from "@/server/repositories/matches";
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
): Promise<MatchWithContext | null> {
  return transaction(async (client) => {
    const result = await client.query<MatchWithContext & QueryResultRow>(sql, params as unknown[]);
    const match = result.rows[0] ?? null;
    if (match) await notifyCommittedMatch(client, match);
    return match;
  });
}

/** Full fixture edits still publish when the public match representation changes. */
export function updateLiveMatch(id: number, input: MatchInput) {
  return updateAndPublish(
    `WITH u AS (
       UPDATE matches SET season_id=$2, home_club_id=$3, away_club_id=$4,
         home_team_name=$5, away_team_name=$6, venue=$7, scheduled_at=$8,
         status=$9, home_score=$10, away_score=$11, period=$12,
         live_revision = live_revision + 1
       WHERE id=$1
       RETURNING *
     )
     SELECT ${CONTEXT_COLUMNS}
       FROM u
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
    `WITH u AS (
       UPDATE matches SET home_score=$2, away_score=$3, status=$4, period=$5,
         live_revision = live_revision + 1
       WHERE id=$1
       RETURNING *
     )
     SELECT ${CONTEXT_COLUMNS}
       FROM u
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
    const result = await client.query<MatchWithContext & QueryResultRow>(
      `WITH u AS (
         UPDATE matches SET ${column} = ${column} + $2,
           live_revision = live_revision + 1
         WHERE id=$1 AND ${column} + $2 >= 0
         RETURNING *
       )
       SELECT ${CONTEXT_COLUMNS}
         FROM u
         JOIN seasons s ON s.id = u.season_id
         LEFT JOIN clubs hc ON hc.id = u.home_club_id
         LEFT JOIN clubs ac ON ac.id = u.away_club_id`,
      [id, delta]
    );
    const match = result.rows[0] ?? null;
    if (match) {
      await notifyCommittedMatch(client, match);
      return { match, scoreRejected: false };
    }
    const exists = await client.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM matches WHERE id = $1) AS exists",
      [id]
    );
    return { match: null, scoreRejected: exists.rows[0]?.exists === true };
  });
}
