import "server-only";
import { query, queryOne } from "@/server/db/pool";
import type { PlayerStatLine, StatLeader } from "./types";

/**
 * REQ-TOURN-003 — statistics.
 *
 * The requirement names exactly two categories, "top scorer" and "top
 * assists"; OQ-008 ("full statistics category list") is still Open, so only
 * those two are aggregated. No other category is inferred.
 */
function leaders(column: "points" | "assists") {
  return (seasonId: number, limit = 10): Promise<StatLeader[]> =>
    query<StatLeader>(
      `SELECT ps.player_name,
              ps.club_id,
              c.name AS club_name,
              c.slug AS club_slug,
              SUM(ps.${column})::int AS total,
              COUNT(DISTINCT ps.match_id)::int AS games
         FROM match_player_stats ps
         JOIN matches m ON m.id = ps.match_id
         LEFT JOIN clubs c ON c.id = ps.club_id
        WHERE m.season_id = $1 AND m.status = 'completed'
        GROUP BY ps.player_name, ps.club_id, c.name, c.slug
       HAVING SUM(ps.${column}) > 0
        ORDER BY total DESC, ps.player_name ASC
        LIMIT $2`,
      [seasonId, Math.min(Math.max(limit, 1), 50)]
    );
}

/** Top scorers for a season (REQ-TOURN-003). */
export const topScorers = leaders("points");

/** Top assists for a season (REQ-TOURN-003). */
export const topAssists = leaders("assists");

export function listMatchStats(matchId: number): Promise<PlayerStatLine[]> {
  return query<PlayerStatLine>(
    `SELECT id, match_id, club_id, player_name, points, assists
       FROM match_player_stats
      WHERE match_id = $1
      ORDER BY points DESC, player_name ASC`,
    [matchId]
  );
}

export type StatLineInput = {
  clubId: number | null;
  playerName: string;
  points: number;
  assists: number;
};

export function upsertStatLine(
  matchId: number,
  input: StatLineInput
): Promise<PlayerStatLine | null> {
  return queryOne<PlayerStatLine>(
    `INSERT INTO match_player_stats (match_id, club_id, player_name, points, assists)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, match_id, club_id, player_name, points, assists`,
    [matchId, input.clubId, input.playerName, input.points, input.assists]
  );
}

export async function deleteStatLine(
  matchId: number,
  id: number
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    "DELETE FROM match_player_stats WHERE id = $1 AND match_id = $2 RETURNING id",
    [id, matchId]
  );
  return rows.length > 0;
}
