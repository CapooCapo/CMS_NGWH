import "server-only";
import { Validator } from "./validate";
import type { ClubInput, ClubMemberInput } from "@/server/repositories/clubs";
import type { MatchInput } from "@/server/repositories/matches";
import type { SeasonInput } from "@/server/repositories/seasons";
import type { StatLineInput } from "@/server/repositories/stats";
import { PLAYER_POSITIONS, STAFF_ROLES } from "@/lib/clubMembers";
import { parseSocialLinks } from "./socialLinks";

/** Parsers for admin write payloads. Each one validates then `assert()`s. */

export function parseClub(body: Record<string, unknown>): ClubInput {
  const v = new Validator(body);
  v.only(["slug", "name", "province", "foundingYear", "logoUrl", "achievementsEn", "achievementsVi", "contactEmail", "contactPhone", "websiteUrl", "socialLinks", "isApproved"]);
  const input: ClubInput = {
    slug: v.slug("slug", { required: true }) ?? "",
    name: v.string("name", { required: true, min: 2, max: 200 }) ?? "",
    province: v.string("province", { required: true, min: 2, max: 160 }) ?? "",
    foundingYear: v.integer("foundingYear", { min: 1800, max: 2200 }),
    logoUrl: v.url("logoUrl"),
    achievementsEn: v.string("achievementsEn", { max: 4000 }),
    achievementsVi: v.string("achievementsVi", { max: 4000 }),
    contactEmail: v.email("contactEmail"),
    contactPhone: v.phone("contactPhone"),
    websiteUrl: v.url("websiteUrl"),
    socialLinks: {},
    isApproved: body.isApproved === true,
  };

  input.socialLinks = parseSocialLinks(body.socialLinks, v);

  v.assert();
  return input;
}

export function parseClubMember(
  body: Record<string, unknown>,
  { allowHeadCoach = false }: { allowHeadCoach?: boolean } = {}
): ClubMemberInput {
  const v = new Validator(body);
  v.only(["fullName", "memberRole", "shirtNumber", "position", "birthYear"]);
  const memberRole =
    v.enum("memberRole", ["player", "coach", "staff"] as const, {
      required: true,
    }) ?? "player";
  const position =
    memberRole === "player"
      ? v.enum("position", PLAYER_POSITIONS)
      : v.enum("position", STAFF_ROLES);
  if (position === "HEAD_COACH" && !allowHeadCoach) {
    v.errors.position ??= "headCoachManaged";
  }
  const input: ClubMemberInput = {
    fullName: v.string("fullName", { required: true, min: 2, max: 160 }) ?? "",
    memberRole,
    shirtNumber: v.integer("shirtNumber", { min: 0, max: 99 }),
    position,
    birthYear: v.integer("birthYear", { min: 1900, max: 2200 }),
  };
  v.assert();
  return input;
}

export function parseSeason(body: Record<string, unknown>): SeasonInput {
  const v = new Validator(body);
  v.only(["slug", "nameEn", "nameVi", "startsOn", "endsOn", "status"]);
  const startsOn = v.string("startsOn", { max: 10 });
  const endsOn = v.string("endsOn", { max: 10 });
  const input: SeasonInput = {
    slug: v.slug("slug", { required: true }) ?? "",
    nameEn: v.string("nameEn", { required: true, min: 2, max: 160 }) ?? "",
    nameVi: v.string("nameVi", { required: true, min: 2, max: 160 }) ?? "",
    startsOn,
    endsOn,
    status:
      v.enum("status", ["upcoming", "active", "completed"] as const, {
        required: true,
      }) ?? "upcoming",
  };
  // Dates arrive as yyyy-mm-dd from <input type="date">; reject anything else.
  for (const [field, value] of [["startsOn", startsOn], ["endsOn", endsOn]] as const) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) v.errors[field] ??= "invalidDate";
  }
  if (startsOn && endsOn && endsOn < startsOn) v.errors.endsOn ??= "outOfRange";
  v.assert();
  return input;
}

export function parseMatch(body: Record<string, unknown>): MatchInput {
  const v = new Validator(body);
  v.only(["seasonId", "homeClubId", "awayClubId", "homeTeamName", "awayTeamName", "venue", "scheduledAt", "status", "homeScore", "awayScore", "period"]);
  const input: MatchInput = {
    seasonId: v.integer("seasonId", { required: true, min: 1 }) ?? 0,
    homeClubId: v.integer("homeClubId", { min: 1 }),
    awayClubId: v.integer("awayClubId", { min: 1 }),
    homeTeamName:
      v.string("homeTeamName", { required: true, min: 1, max: 160 }) ?? "",
    awayTeamName:
      v.string("awayTeamName", { required: true, min: 1, max: 160 }) ?? "",
    venue: v.string("venue", { max: 200 }),
    scheduledAt: v.dateTime("scheduledAt", { required: true }) ?? new Date(),
    status:
      v.enum(
        "status",
        ["scheduled", "live", "completed", "postponed", "cancelled"] as const,
        { required: true }
      ) ?? "scheduled",
    homeScore: v.integer("homeScore", { min: 0, max: 500 }) ?? 0,
    awayScore: v.integer("awayScore", { min: 0, max: 500 }) ?? 0,
    period: v.string("period", { max: 20 }),
  };
  // Mirrors the matches_distinct_teams CHECK so the user gets a field error
  // instead of a constraint violation.
  if (
    input.homeClubId !== null &&
    input.homeClubId === input.awayClubId
  ) {
    v.errors.awayClubId ??= "invalidChoice";
  }
  v.assert();
  return input;
}

export function parseScore(body: Record<string, unknown>) {
  const v = new Validator(body);
  v.only(["homeScore", "awayScore", "status", "period"]);
  const input = {
    homeScore: v.integer("homeScore", { required: true, min: 0, max: 500 }) ?? 0,
    awayScore: v.integer("awayScore", { required: true, min: 0, max: 500 }) ?? 0,
    status:
      v.enum(
        "status",
        ["scheduled", "live", "completed", "postponed", "cancelled"] as const,
        { required: true }
      ) ?? "scheduled",
    period: v.string("period", { max: 20 }),
  };
  v.assert();
  return input;
}

export function parseScoreAdjustment(body: Record<string, unknown>) {
  const v = new Validator(body);
  v.only(["team", "side", "kind", "delta"]);
  // `side` was used by the first live-control rollout; accept it as a
  // compatibility alias while clients use the clearer public `team` field.
  const teamField = body.team === undefined ? "side" : "team";
  const team = v.enum(teamField, ["home", "away"] as const, { required: true }) ?? "home";
  const kind = v.enum("kind", ["score", "foul"] as const) ?? "score";
  const parsedDelta = v.integer("delta", { required: true, min: -3, max: 3 });
  const allowed = kind === "score" ? [-3, -2, -1, 1, 2, 3] : [-1, 1];
  if (!allowed.includes(parsedDelta ?? 0)) v.errors.delta ??= "invalidChoice";
  v.assert();
  return { team, kind, delta: parsedDelta as -3 | -2 | -1 | 1 | 2 | 3 };
}

export function parseStatLine(body: Record<string, unknown>): StatLineInput {
  const v = new Validator(body);
  v.only(["clubId", "playerName", "points", "assists"]);
  const input: StatLineInput = {
    clubId: v.integer("clubId", { min: 1 }),
    playerName: v.string("playerName", { required: true, min: 2, max: 160 }) ?? "",
    // REQ-TOURN-003 names exactly these two categories; OQ-008 blocks the rest.
    points: v.integer("points", { min: 0, max: 200 }) ?? 0,
    assists: v.integer("assists", { min: 0, max: 100 }) ?? 0,
  };
  v.assert();
  return input;
}
