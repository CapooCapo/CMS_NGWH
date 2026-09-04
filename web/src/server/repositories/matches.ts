import "server-only";
import { query, queryOne } from "@/server/db/pool";
import type { Match, MatchStatus, MatchWithContext } from "./types";

const BASE = `m.id, m.season_id, m.home_club_id, m.away_club_id,
  m.home_team_name, m.away_team_name, m.venue,
  to_char(m.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS scheduled_at,
  m.status, m.home_score, m.away_score, m.home_fouls, m.away_fouls,
  m.period, m.live_revision`;

const WITH_CONTEXT = `${BASE},
  s.slug AS season_slug, s.name_en AS season_name_en, s.name_vi AS season_name_vi,
  hc.slug AS home_club_slug, ac.slug AS away_club_slug,
  hc.logo_url AS home_club_logo, ac.logo_url AS away_club_logo`;

const JOINS = `FROM matches m
  JOIN seasons s ON s.id = m.season_id
  LEFT JOIN clubs hc ON hc.id = m.home_club_id
  LEFT JOIN clubs ac ON ac.id = m.away_club_id`;

/** REQ-TOURN-001 — match schedule by date/time for one season. */
export function listMatchesBySeason(
  seasonId: number
): Promise<MatchWithContext[]> {
  return query<MatchWithContext>(
    `SELECT ${WITH_CONTEXT} ${JOINS}
      WHERE m.season_id = $1
      ORDER BY m.scheduled_at ASC, m.id ASC`,
    [seasonId]
  );
}

/** Completed games, newest first — the "Results" view. */
export function listResultsBySeason(
  seasonId: number
): Promise<MatchWithContext[]> {
  return query<MatchWithContext>(
    `SELECT ${WITH_CONTEXT} ${JOINS}
      WHERE m.season_id = $1 AND m.status = 'completed'
      ORDER BY m.scheduled_at DESC, m.id DESC`,
    [seasonId]
  );
}

export function findMatchById(id: number): Promise<MatchWithContext | null> {
  return queryOne<MatchWithContext>(
    `SELECT ${WITH_CONTEXT} ${JOINS} WHERE m.id = $1`,
    [id]
  );
}

export function listAllMatches(limit = 200): Promise<MatchWithContext[]> {
  return query<MatchWithContext>(
    `SELECT ${WITH_CONTEXT} ${JOINS}
      ORDER BY m.scheduled_at DESC, m.id DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500)]
  );
}

/** Every match currently in play — drives the public live scoreboard. */
export function listLiveMatches(): Promise<MatchWithContext[]> {
  return query<MatchWithContext>(
    `SELECT ${WITH_CONTEXT} ${JOINS}
      WHERE m.status = 'live'
      ORDER BY m.scheduled_at ASC, m.id ASC`
  );
}

/**
 * REQ-HOME-005 — the Live & Results widget.
 *
 * OQ-004 (closed 2026-08-20): show a live match first; if none is live, show
 * the most recently finished match. `upcoming` is returned alongside so the
 * widget can still say something useful before a season starts.
 */
export async function getLiveAndResults(limit = 4): Promise<{
  live: MatchWithContext[];
  recent: MatchWithContext[];
  upcoming: MatchWithContext[];
}> {
  const capped = Math.min(Math.max(limit, 1), 20);
  const [live, recent, upcoming] = await Promise.all([
    listLiveMatches(),
    query<MatchWithContext>(
      `SELECT ${WITH_CONTEXT} ${JOINS}
        WHERE m.status = 'completed'
        ORDER BY m.scheduled_at DESC, m.id DESC LIMIT $1`,
      [capped]
    ),
    query<MatchWithContext>(
      `SELECT ${WITH_CONTEXT} ${JOINS}
        WHERE m.status = 'scheduled' AND m.scheduled_at >= now()
        ORDER BY m.scheduled_at ASC, m.id ASC LIMIT $1`,
      [capped]
    ),
  ]);
  return { live, recent, upcoming };
}

export type MatchInput = {
  seasonId: number;
  homeClubId: number | null;
  awayClubId: number | null;
  homeTeamName: string;
  awayTeamName: string;
  venue: string | null;
  scheduledAt: Date;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  period: string | null;
};

export function createMatch(input: MatchInput): Promise<Match | null> {
  return queryOne<Match>(
    `INSERT INTO matches (season_id, home_club_id, away_club_id, home_team_name,
       away_team_name, venue, scheduled_at, status, home_score, away_score, period)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, season_id, home_club_id, away_club_id, home_team_name,
       away_team_name, venue,
       to_char(scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS scheduled_at,
       status, home_score, away_score, home_fouls, away_fouls, period, live_revision`,
    [
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

export async function deleteMatch(id: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    "DELETE FROM matches WHERE id = $1 RETURNING id",
    [id]
  );
  return rows.length > 0;
}
