import "server-only";

/** Row shapes returned by the repositories. These mirror the SQL schema. */

export type SeasonStatus = "upcoming" | "active" | "completed";

export type Season = {
  id: number;
  slug: string;
  name_en: string;
  name_vi: string;
  starts_on: string | null;
  ends_on: string | null;
  status: SeasonStatus;
};

export type Club = {
  id: number;
  slug: string;
  name: string;
  province: string;
  founding_year: number | null;
  logo_url: string | null;
  achievements_en: string | null;
  achievements_vi: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  is_approved: boolean;
  approved_at: string | null;
  owner_id: number | null;
};

export type ClubMemberRole = "player" | "coach" | "staff";

export type ClubMember = {
  id: number;
  club_id: number;
  full_name: string;
  member_role: ClubMemberRole;
  shirt_number: number | null;
  position: string | null;
  birth_year: number | null;
  /** Set when this member row *is* an account holder (the registrant/head coach). */
  club_owner_id: number | null;
  /** A distinction within `member_role === "coach"`, not a fourth role. */
  is_head_coach: boolean;
};

export type RegistrationStatus = "pending" | "approved" | "rejected";

export type ClubRegistration = {
  id: number;
  club_name: string;
  operating_region: string;
  representative_name: string;
  representative_email: string;
  representative_phone: string | null;
  notes: string | null;
  status: RegistrationStatus;
  review_note: string | null;
  reviewed_at: string | null;
  club_id: number | null;
  /** The authenticated account that submitted this — never client-supplied. */
  club_owner_id: number | null;
  created_at: string;
};

export type MatchStatus =
  | "scheduled"
  | "live"
  | "completed"
  | "postponed"
  | "cancelled";

export type Match = {
  id: number;
  season_id: number;
  home_club_id: number | null;
  away_club_id: number | null;
  home_team_name: string;
  away_team_name: string;
  venue: string | null;
  scheduled_at: string;
  status: MatchStatus;
  home_score: number;
  away_score: number;
  home_fouls: number;
  away_fouls: number;
  period: string | null;
  /** Monotonic public-live revision, incremented by every match update. */
  live_revision: number;
};

/** A match joined with the season and club slugs needed for links. */
export type MatchWithContext = Match & {
  season_slug: string;
  season_name_en: string;
  season_name_vi: string;
  home_club_slug: string | null;
  away_club_slug: string | null;
  home_club_logo: string | null;
  away_club_logo: string | null;
};

export type ContactStatus = "new" | "read" | "archived";

export type ContactMessage = {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  locale: string;
  status: ContactStatus;
  created_at: string;
};

export type PlayerStatLine = {
  id: number;
  match_id: number;
  club_id: number | null;
  player_name: string;
  points: number;
  assists: number;
};

/** Aggregated leader row for REQ-TOURN-003 (points and assists only). */
export type StatLeader = {
  player_name: string;
  club_id: number | null;
  club_name: string | null;
  club_slug: string | null;
  total: number;
  games: number;
};
