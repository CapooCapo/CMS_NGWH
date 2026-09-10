import type { ClubMemberRole } from "../types";
import { STAFF_ROLES } from "@/lib/clubMembers";

export const CLUB_COLUMNS = `id, slug, name, province, founding_year, logo_url,
  achievements_en, achievements_vi, contact_email, contact_phone, website_url,
  social_links, is_approved, owner_id,
  to_char(approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS approved_at,
  (SELECT to_char(requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
     FROM club_deletion_requests WHERE club_id = clubs.id) AS deletion_requested_at`;
export const MEMBER_COLUMNS = `id, club_id, full_name, member_role, shirt_number,
  position, birth_year, club_owner_id, is_head_coach`;
export const HEAD_COACH_POSITION = STAFF_ROLES[0];

export type ClubFilter = { approvedOnly: boolean; province?: string | null; search?: string | null; limit?: number; offset?: number };
export type ClubInput = { slug: string; name: string; province: string; foundingYear: number | null; logoUrl: string | null; achievementsEn: string | null; achievementsVi: string | null; contactEmail: string | null; contactPhone: string | null; websiteUrl: string | null; socialLinks: Record<string, string>; isApproved: boolean };
export type ClubMemberInput = { fullName: string; memberRole: ClubMemberRole; shirtNumber: number | null; position: string | null; birthYear: number | null };

export function clubWhere(filter: ClubFilter) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.approvedOnly) where.push("is_approved = TRUE");
  if (filter.province) { params.push(filter.province); where.push(`province = $${params.length}`); }
  if (filter.search) { params.push(`%${filter.search}%`); where.push(`(name ILIKE $${params.length} OR province ILIKE $${params.length})`); }
  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}
