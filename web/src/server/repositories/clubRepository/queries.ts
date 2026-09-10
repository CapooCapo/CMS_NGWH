import "server-only";
import { query, queryOne } from "@/server/db/pool";
import { ADMIN_PAGE_SIZE, resolvePagination, type PaginatedResult } from "@/lib/pagination";
import type { Club } from "../types";
import { CLUB_COLUMNS, clubWhere, type ClubFilter } from "./shared";

export async function listClubs(filter: ClubFilter): Promise<{ rows: Club[]; total: number }> {
  const { whereSql, params } = clubWhere(filter);
  const totalRow = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM clubs ${whereSql}`, params);
  const limit = Math.min(Math.max(filter.limit ?? 24, 1), 100);
  const offset = Math.max(filter.offset ?? 0, 0);
  params.push(limit, offset);
  const rows = await query<Club>(`SELECT ${CLUB_COLUMNS} FROM clubs ${whereSql} ORDER BY name ASC, id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { rows, total: Number(totalRow?.count ?? 0) };
}
export async function listAdminClubs(requestedPage: number, highlightId: number | null = null): Promise<PaginatedResult<Club>> {
  const { whereSql, params } = clubWhere({ approvedOnly: false });
  const totalRow = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM clubs ${whereSql}`, params);
  const total = Number(totalRow?.count ?? 0);
  let page = requestedPage;
  if (highlightId && Number.isSafeInteger(highlightId) && highlightId > 0) {
    const highlighted = await queryOne<{ name: string; id: number }>("SELECT name, id FROM clubs WHERE id = $1", [highlightId]);
    if (highlighted) {
      const before = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM clubs WHERE name < $1 OR (name = $1 AND id < $2)`, [highlighted.name, highlighted.id]);
      page = Math.floor(Number(before?.count ?? 0) / ADMIN_PAGE_SIZE) + 1;
    }
  }
  const pagination = resolvePagination(page, total, ADMIN_PAGE_SIZE);
  const rows = await query<Club>(`SELECT ${CLUB_COLUMNS} FROM clubs ORDER BY name ASC, id ASC LIMIT $1 OFFSET $2`, [pagination.pageSize, pagination.offset]);
  return { ...pagination, rows };
}
export async function listProvinces(approvedOnly: boolean): Promise<string[]> {
  const rows = await query<{ province: string }>(`SELECT DISTINCT province FROM clubs ${approvedOnly ? "WHERE is_approved = TRUE" : ""} ORDER BY province ASC`);
  return rows.map((row) => row.province);
}
export function findClubBySlug(slug: string, approvedOnly: boolean): Promise<Club | null> { return queryOne<Club>(`SELECT ${CLUB_COLUMNS} FROM clubs WHERE slug = $1 ${approvedOnly ? "AND is_approved = TRUE" : ""}`, [slug]); }
export function findClubById(id: number): Promise<Club | null> { return queryOne<Club>(`SELECT ${CLUB_COLUMNS} FROM clubs WHERE id = $1`, [id]); }
