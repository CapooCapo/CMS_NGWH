import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { query, pool } from "../src/server/db/pool";
import {
  clearClubHeadCoach,
  createClub,
  createClubMember,
  deleteClubMember,
  listClubMembers,
  updateClub,
  updateClubMember,
} from "../src/server/repositories/clubs";
import type { Club } from "../src/server/repositories/types";

/**
 * REQ-CLUB-004/005/006 against the real database.
 *
 * Covers the repository layer behind the admin "edit club" and roster/staff
 * table UI: editing an existing club's profile fields (incl. achievements,
 * contact and social links) and the full create/edit/delete cycle for a
 * club_members row (roster + coaching staff share this table via
 * `member_role`). Everything lives under a uniquely-slugged fixture and is
 * removed afterwards.
 */
const TAG = `test-clubs-${process.pid}`;
let club: Club;

before(async () => {
  const created = await createClub({
    slug: TAG,
    name: "Test Club",
    province: "Testville",
    foundingYear: 2020,
    logoUrl: null,
    achievementsEn: null,
    achievementsVi: null,
    contactEmail: null,
    contactPhone: null,
    websiteUrl: null,
    socialLinks: {},
    isApproved: true,
  });
  if (!created) throw new Error("fixture club was not created");
  club = created;
});

after(async () => {
  await query("DELETE FROM clubs WHERE slug = $1", [TAG]);
  await pool.end();
});

test("updateClub persists achievements, contact and social links", async () => {
  const updated = await updateClub(club.id, {
    slug: club.slug,
    name: "Test Club Updated",
    province: "Testville",
    foundingYear: 2020,
    logoUrl: "https://example.com/logo.png",
    achievementsEn: "Runner-up, 2024 season",
    achievementsVi: "Á quân mùa giải 2024",
    contactEmail: "club@example.com",
    contactPhone: "0900112277",
    websiteUrl: "https://example.com",
    socialLinks: { facebook: "https://www.facebook.com/example" },
    isApproved: true,
  });
  assert.ok(updated);
  assert.equal(updated!.name, "Test Club Updated");
  assert.equal(updated!.achievements_en, "Runner-up, 2024 season");
  assert.equal(updated!.achievements_vi, "Á quân mùa giải 2024");
  assert.equal(updated!.contact_phone, "0900112277");
  assert.deepEqual(updated!.social_links, { facebook: "https://www.facebook.com/example" });
});

test("updateClub returns null for a club id that does not exist", async () => {
  const result = await updateClub(-1, {
    slug: "does-not-exist",
    name: "X",
    province: "Y",
    foundingYear: null,
    logoUrl: null,
    achievementsEn: null,
    achievementsVi: null,
    contactEmail: null,
    contactPhone: null,
    websiteUrl: null,
    socialLinks: {},
    isApproved: false,
  });
  assert.equal(result, null);
});

test("club member create / edit / delete round-trip, scoped to its club", async () => {
  const player = await createClubMember(club.id, {
    fullName: "Nguyen A",
    memberRole: "player",
    shirtNumber: 7,
    position: "PG",
    birthYear: 2006,
  });
  assert.ok(player);

  const listed = await listClubMembers(club.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].full_name, "Nguyen A");

  const edited = await updateClubMember(club.id, player!.id, {
    fullName: "Nguyen A.",
    memberRole: "player",
    shirtNumber: 8,
    position: "SF",
    birthYear: 2006,
  });
  assert.ok(edited);
  assert.equal(edited!.full_name, "Nguyen A.");
  assert.equal(edited!.shirt_number, 8);
  assert.equal(edited!.position, "SF");

  // Scoped by club id: editing/deleting through a different club id must fail.
  const wrongClubEdit = await updateClubMember(-1, player!.id, {
    fullName: "Hijacked",
    memberRole: "player",
    shirtNumber: 1,
    position: null,
    birthYear: null,
  });
  assert.equal(wrongClubEdit, null);

  const wrongClubDelete = await deleteClubMember(-1, player!.id);
  assert.equal(wrongClubDelete.ok, false);

  const stillThere = await listClubMembers(club.id);
  assert.equal(stillThere.length, 1);
  assert.equal(stillThere[0].full_name, "Nguyen A.", "unaffected by the wrong-club calls");

  const deleted = await deleteClubMember(club.id, player!.id);
  assert.equal(deleted.ok, true);
  assert.equal((await listClubMembers(club.id)).length, 0);
});

test("roster and coaching staff share club_members, ordered players first", async () => {
  const coach = await createClubMember(club.id, {
    fullName: "Coach B",
    memberRole: "coach",
    shirtNumber: null,
    position: "ASSISTANT_COACH",
    birthYear: 1985,
  });
  const player = await createClubMember(club.id, {
    fullName: "Player C",
    memberRole: "player",
    shirtNumber: 4,
    position: "C",
    birthYear: 2007,
  });
  assert.ok(coach && player);

  const members = await listClubMembers(club.id);
  assert.equal(members.length, 2);
  assert.equal(members[0].member_role, "player", "players are listed before coaching staff");
  assert.equal(members[1].member_role, "coach");

  await deleteClubMember(club.id, coach!.id);
  await deleteClubMember(club.id, player!.id);
});

/**
 * The head-coach row is the club owner's identity on the club (created by
 * approving their registration), which is why it is protected from deletion.
 * These cover the repository-level invariants directly; the HTTP behaviour
 * they produce is in `registration-workflow.test.ts`.
 */
test("the head-coach row is refused by deleteClubMember, and released by clearClubHeadCoach", async () => {
  const coach = await createClubMember(club.id, {
    fullName: "Head Coach C",
    memberRole: "coach",
    shirtNumber: null,
    position: "HEAD_COACH",
    birthYear: 1980,
  });
  await query("UPDATE club_members SET is_head_coach = TRUE WHERE id = $1", [coach!.id]);

  const refused = await deleteClubMember(club.id, coach!.id);
  assert.equal(refused.ok, false);
  assert.equal(refused.ok === false && refused.reason, "headCoach");
  assert.equal((await listClubMembers(club.id)).length, 1, "still there");

  // Renaming is allowed, and the role cannot be changed away from coach.
  const renamed = await updateClubMember(club.id, coach!.id, {
    fullName: "Renamed Coach",
    memberRole: "player",
    shirtNumber: null,
    position: "PG",
    birthYear: 1980,
  });
  assert.equal(renamed!.full_name, "Renamed Coach");
  assert.equal(renamed!.member_role, "coach", "head coach stays a coach");
  assert.equal(renamed!.is_head_coach, true);
  assert.equal(renamed!.position, "HEAD_COACH", "head coach keeps its canonical role");

  // Unassigning the owner releases it, so it stops being undeletable.
  await clearClubHeadCoach(club.id);
  const after = await listClubMembers(club.id);
  assert.equal(after[0].is_head_coach, false);
  assert.equal(after[0].club_owner_id, null);

  const removed = await deleteClubMember(club.id, coach!.id);
  assert.equal(removed.ok, true);
});

test("only one head coach per club is possible", async () => {
  const a = await createClubMember(club.id, {
    fullName: "Coach One", memberRole: "coach", shirtNumber: null, position: null, birthYear: null,
  });
  const b = await createClubMember(club.id, {
    fullName: "Coach Two", memberRole: "coach", shirtNumber: null, position: null, birthYear: null,
  });
  await query("UPDATE club_members SET is_head_coach = TRUE WHERE id = $1", [a!.id]);

  await assert.rejects(
    () => query("UPDATE club_members SET is_head_coach = TRUE WHERE id = $1", [b!.id]),
    /duplicate key|unique/i,
    "the partial unique index rejects a second head coach"
  );

  await clearClubHeadCoach(club.id);
  await deleteClubMember(club.id, a!.id);
  await deleteClubMember(club.id, b!.id);
});
