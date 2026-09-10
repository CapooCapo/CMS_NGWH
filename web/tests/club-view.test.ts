import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clubSocialLinks,
  groupClubMembers,
  localizedClubAchievements,
} from "../src/lib/clubView";
import type { Club, ClubMember } from "../src/server/repositories/types";

const club = (overrides: Partial<Club> = {}): Club => ({
  id: 1,
  slug: "tigers",
  name: "Tigers",
  province: "Hanoi",
  founding_year: null,
  logo_url: null,
  achievements_en: "Champions",
  achievements_vi: "Vô địch",
  contact_email: null,
  contact_phone: null,
  website_url: null,
  social_links: { facebook: "https://facebook.example/tigers" },
  is_approved: true,
  approved_at: null,
  owner_id: null,
  deletion_requested_at: null,
  ...overrides,
});

const member = (
  id: number,
  role: ClubMember["member_role"],
  isHeadCoach = false
): ClubMember => ({
  id,
  club_id: 1,
  full_name: role + "-" + id,
  member_role: role,
  shirt_number: null,
  position: null,
  birth_year: null,
  club_owner_id: null,
  is_head_coach: isHeadCoach,
});

test("club view groups players, coaches, staff, and selects one head coach", () => {
  const groups = groupClubMembers([
    member(1, "staff"),
    member(2, "player"),
    member(3, "coach", true),
    member(4, "coach"),
  ]);

  assert.deepEqual(groups.players.map((item) => item.id), [2]);
  assert.deepEqual(groups.coaches.map((item) => item.id), [3, 4]);
  assert.deepEqual(groups.supportStaff.map((item) => item.id), [1]);
  assert.deepEqual(groups.coachStaff.map((item) => item.id), [3, 4, 1]);
  assert.equal(groups.headCoach?.id, 3);
  assert.equal(groupClubMembers([member(5, "player")]).headCoach, null);
});

test("club view uses preferred achievement locale, then the other locale, then null", () => {
  assert.equal(localizedClubAchievements(club(), "vi"), "Vô địch");
  assert.equal(localizedClubAchievements(club(), "en"), "Champions");
  assert.equal(
    localizedClubAchievements(club({ achievements_en: "Champions", achievements_vi: null }), "vi"),
    "Champions"
  );
  assert.equal(
    localizedClubAchievements(club({ achievements_en: null, achievements_vi: "Vô địch" }), "en"),
    "Vô địch"
  );
  assert.equal(
    localizedClubAchievements(club({ achievements_en: null, achievements_vi: null }), "vi"),
    null
  );
});

test("club social links preserve the established empty/null fallback", () => {
  assert.deepEqual(clubSocialLinks(club()), [["facebook", "https://facebook.example/tigers"]]);
  assert.deepEqual(clubSocialLinks(club({ social_links: {} })), []);
  assert.deepEqual(
    clubSocialLinks({ ...club(), social_links: null as unknown as Record<string, string> }),
    []
  );
});
