import type { Club, ClubMember } from "@/server/repositories/types";

/** Locale fallback shared by public and owner club surfaces. */
export function localizedClubAchievements(club: Club, locale: string): string | null {
  return locale === "vi"
    ? club.achievements_vi || club.achievements_en
    : club.achievements_en || club.achievements_vi;
}

/** Stable roster groups prevent public and owner pages from drifting. */
export function groupClubMembers(members: readonly ClubMember[]) {
  const players = members.filter((member) => member.member_role === "player");
  const coaches = members.filter((member) => member.member_role === "coach");
  const supportStaff = members.filter((member) => member.member_role === "staff");
  return {
    players,
    coaches,
    supportStaff,
    coachStaff: [...coaches, ...supportStaff],
    headCoach: members.find((member) => member.is_head_coach) ?? null,
  };
}

export function clubSocialLinks(club: Club): [string, string][] {
  return Object.entries(club.social_links ?? {});
}
