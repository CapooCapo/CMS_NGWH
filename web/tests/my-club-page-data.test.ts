import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMyClubApprovedPageData } from "../src/server/services/myClub";
import type { Club, ClubMember } from "../src/server/repositories/types";
import type { RegistrationDocumentMeta } from "../src/server/repositories/registrations";
import type { OwnerWorkspace } from "../src/server/services/ownerWorkspace";

const club = {
  id: 1, slug: "tigers", name: "Tigers", province: "Hanoi", founding_year: 2020, logo_url: null,
  achievements_en: "Champions", achievements_vi: null, contact_email: null, contact_phone: null,
  website_url: null, social_links: { facebook: "https://facebook.example/tigers" }, is_approved: true,
  owner_id: 4, approved_at: null, deletion_requested_at: null,
} satisfies Club;
const workspace: Extract<OwnerWorkspace, { state: "approved" }> = {
  state: "approved", owner: { id: 4, email: "owner@example.com", full_name: "Owner" }, club, registration: null,
};
const members: ClubMember[] = [
  { id: 1, club_id: 1, full_name: "Player", member_role: "player", shirt_number: 7, position: "PG", birth_year: null, club_owner_id: null, is_head_coach: false },
  { id: 2, club_id: 1, full_name: "Coach", member_role: "coach", shirt_number: null, position: "HEAD_COACH", birth_year: null, club_owner_id: 4, is_head_coach: true },
  { id: 3, club_id: 1, full_name: "Staff", member_role: "staff", shirt_number: null, position: "TEAM_MANAGER", birth_year: null, club_owner_id: null, is_head_coach: false },
];

test("approved My Club view model groups members and applies locale fallback", () => {
  const documents: RegistrationDocumentMeta[] = [
    { id: 8, filename: "license.pdf", content_type: "application/pdf", byte_size: 12, is_public: false },
  ];
  const data = buildMyClubApprovedPageData(workspace, members, documents, "vi");
  assert.deepEqual(data.players.map((member) => member.full_name), ["Player"]);
  assert.deepEqual(data.coachStaff.map((member) => member.full_name), ["Coach", "Staff"]);
  assert.equal(data.headCoach?.full_name, "Coach");
  assert.equal(data.achievements, "Champions");
  assert.deepEqual(data.socials, [["facebook", "https://facebook.example/tigers"]]);
  assert.deepEqual(data.documents, documents);
});
