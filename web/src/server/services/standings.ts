import "server-only";
import { query } from "@/server/db/pool";

/**
 * REQ-TOURN-002 — standings, automatically updated.
 *
 * Status in .ai/REQUIREMENTS.md is BLOCKED on two Open Questions:
 *   - OQ-005 (closed 2026-08-20): use the existing match DB architecture. Done —
 *     standings are derived from the `matches` table, not stored separately.
 *   - OQ-007 (Open): the update *mechanism and frequency* are undecided.
 *
 * ASSUMPTION, chosen as the least-destructive reading of "automatically
 * updated": the table is computed on read from completed matches, so it is
 * always exactly consistent with recorded results and there is no schedule,
 * cache or job to get out of step. If OQ-007 later specifies a materialised
 * table or a refresh cadence, only this module changes.
 *
 * Basketball has no draws, so the table is wins/losses plus points for/against.
 * Ordering: wins desc, then point difference, then points scored, then name —
 * a deterministic total order. Any tie-break rules beyond this are part of
 * OQ-007 and are deliberately not invented.
 */
export type StandingRow = {
  club_id: number | null;
  team_name: string;
  club_slug: string | null;
  played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  win_pct: number;
};

export async function computeStandings(
  seasonId: number
): Promise<StandingRow[]> {
  // One row per team per completed match, from both the home and away side,
  // then aggregated. Teams are keyed by club id where known and by name
  // otherwise, so fixtures created before a club profile exists still appear.
  const rows = await query<{
    club_id: number | null;
    team_name: string;
    club_slug: string | null;
    played: string;
    wins: string;
    losses: string;
    points_for: string;
    points_against: string;
  }>(
    `WITH sides AS (
       SELECT m.home_club_id AS club_id, m.home_team_name AS team_name,
              m.home_score AS scored, m.away_score AS conceded
         FROM matches m
        WHERE m.season_id = $1 AND m.status = 'completed'
       UNION ALL
       SELECT m.away_club_id AS club_id, m.away_team_name AS team_name,
              m.away_score AS scored, m.home_score AS conceded
         FROM matches m
        WHERE m.season_id = $1 AND m.status = 'completed'
     )
     SELECT sides.club_id,
            COALESCE(c.name, sides.team_name) AS team_name,
            c.slug AS club_slug,
            COUNT(*)::text AS played,
            SUM(CASE WHEN sides.scored > sides.conceded THEN 1 ELSE 0 END)::text AS wins,
            SUM(CASE WHEN sides.scored < sides.conceded THEN 1 ELSE 0 END)::text AS losses,
            SUM(sides.scored)::text AS points_for,
            SUM(sides.conceded)::text AS points_against
       FROM sides
       LEFT JOIN clubs c ON c.id = sides.club_id
      GROUP BY sides.club_id, COALESCE(c.name, sides.team_name), c.slug
      ORDER BY wins DESC`,
    [seasonId]
  );

  return rows
    .map((r) => {
      const played = Number(r.played);
      const wins = Number(r.wins);
      const pointsFor = Number(r.points_for);
      const pointsAgainst = Number(r.points_against);
      return {
        club_id: r.club_id,
        team_name: r.team_name,
        club_slug: r.club_slug,
        played,
        wins,
        losses: Number(r.losses),
        points_for: pointsFor,
        points_against: pointsAgainst,
        point_diff: pointsFor - pointsAgainst,
        win_pct: played > 0 ? wins / played : 0,
      };
    })
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.point_diff - a.point_diff ||
        b.points_for - a.points_for ||
        a.team_name.localeCompare(b.team_name)
    );
}
