import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_POSITIONS,
  STAFF_ROLES,
} from "../src/lib/clubMembers";
import { parseClubMember } from "../src/server/validation/admin";

const base = { fullName: "Domain Test", shirtNumber: 7, birthYear: 2004 };

test("the roster domain exposes the exact stable player and staff codes", () => {
  assert.deepEqual(PLAYER_POSITIONS, ["PG", "SG", "SF", "PF", "C"]);
  assert.deepEqual(STAFF_ROLES, [
    "HEAD_COACH",
    "ASSISTANT_COACH",
    "TEAM_MANAGER",
    "TEAM_DOCTOR",
    "PHYSIOTHERAPIST",
    "STATISTICIAN",
    "INTERPRETER",
  ]);
});

test("player positions are stored as canonical codes and reject free text", () => {
  for (const position of PLAYER_POSITIONS) {
    assert.equal(
      parseClubMember({ ...base, memberRole: "player", position }).position,
      position
    );
  }
  for (const position of ["GK", "GOAT", "Guard", "Forward", "Point Guard", "Hậu vệ"]) {
    assert.throws(() => parseClubMember({ ...base, memberRole: "player", position }));
  }
});

test("staff roles are stored as canonical codes and head coach stays managed", () => {
  for (const position of STAFF_ROLES.filter((role) => role !== "HEAD_COACH")) {
    assert.equal(
      parseClubMember({ ...base, memberRole: "staff", position }).position,
      position
    );
  }
  assert.throws(() =>
    parseClubMember({ ...base, memberRole: "coach", position: "HEAD_COACH" })
  );
  assert.equal(
    parseClubMember(
      { ...base, memberRole: "coach", position: "HEAD_COACH" },
      { allowHeadCoach: true }
    ).position,
    "HEAD_COACH"
  );
  for (const position of ["Coach", "Manager", "Doctor", "GOAT"]) {
    assert.throws(() => parseClubMember({ ...base, memberRole: "staff", position }));
  }
});
