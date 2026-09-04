import "server-only";
import { query, queryOne } from "@/server/db/pool";
import type { Season, SeasonStatus } from "./types";

const COLUMNS = `id, slug, name_en, name_vi,
  to_char(starts_on, 'YYYY-MM-DD') AS starts_on,
  to_char(ends_on, 'YYYY-MM-DD') AS ends_on,
  status`;

/** REQ-TOURN-004 — archive listing: newest season first. */
export function listSeasons(): Promise<Season[]> {
  return query<Season>(
    `SELECT ${COLUMNS} FROM seasons
      ORDER BY COALESCE(starts_on, '1900-01-01') DESC, id DESC`
  );
}

export function findSeasonBySlug(slug: string): Promise<Season | null> {
  return queryOne<Season>(`SELECT ${COLUMNS} FROM seasons WHERE slug = $1`, [
    slug,
  ]);
}

export function findSeasonById(id: number): Promise<Season | null> {
  return queryOne<Season>(`SELECT ${COLUMNS} FROM seasons WHERE id = $1`, [id]);
}

/**
 * The season a visitor should land on: the active one, else the most recent by
 * start date. Returns null when no seasons exist at all.
 */
export function findCurrentSeason(): Promise<Season | null> {
  return queryOne<Season>(
    `SELECT ${COLUMNS} FROM seasons
      ORDER BY (status = 'active') DESC,
               COALESCE(starts_on, '1900-01-01') DESC, id DESC
      LIMIT 1`
  );
}

export type SeasonInput = {
  slug: string;
  nameEn: string;
  nameVi: string;
  startsOn: string | null;
  endsOn: string | null;
  status: SeasonStatus;
};

export function createSeason(input: SeasonInput): Promise<Season | null> {
  return queryOne<Season>(
    `INSERT INTO seasons (slug, name_en, name_vi, starts_on, ends_on, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [
      input.slug,
      input.nameEn,
      input.nameVi,
      input.startsOn,
      input.endsOn,
      input.status,
    ]
  );
}

export function updateSeason(
  id: number,
  input: SeasonInput
): Promise<Season | null> {
  return queryOne<Season>(
    `UPDATE seasons
        SET slug = $2, name_en = $3, name_vi = $4,
            starts_on = $5, ends_on = $6, status = $7
      WHERE id = $1 RETURNING ${COLUMNS}`,
    [
      id,
      input.slug,
      input.nameEn,
      input.nameVi,
      input.startsOn,
      input.endsOn,
      input.status,
    ]
  );
}
