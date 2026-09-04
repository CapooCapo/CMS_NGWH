import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { query, pool } from "../src/server/db/pool";
import { findClubById, findClubByOwnerId, setClubOwner } from "../src/server/repositories/clubs";
import {
  createAndAssignClubOwner,
  deactivateClubOwner,
  findClubOwnerByEmailWithHash,
  unassignClubOwner,
} from "../src/server/repositories/clubOwners";
import { approveRegistration } from "../src/server/services/registrationReview";

/**
 * Club Owner account creation/assignment against the real database — the
 * transactional edge cases `createAndAssignClubOwner` exists to make
 * impossible: assigning an owner to an already-owned club, or reusing an
 * email, must never half-apply. Everything lives under uniquely-slugged/
 * emailed fixtures and is removed afterwards.
 */
const TAG = `test-clubowners-${process.pid}`;
let clubAId: number;
let clubBId: number;
const emailA = `${TAG}-a@example.com`;
const emailB = `${TAG}-b@example.com`;

before(async () => {
  const [a] = await query<{ id: number }>(
    `INSERT INTO clubs (slug, name, province, is_approved) VALUES ($1, 'Owner Test Club A', 'Testville', TRUE) RETURNING id`,
    [`${TAG}-a`]
  );
  clubAId = a.id;
  const [b] = await query<{ id: number }>(
    `INSERT INTO clubs (slug, name, province, is_approved) VALUES ($1, 'Owner Test Club B', 'Testville', TRUE) RETURNING id`,
    [`${TAG}-b`]
  );
  clubBId = b.id;
});

after(async () => {
  // Migration 007 restricts deleting an identified registrant, so remove any
  // registrations before their fixture accounts.
  await query("DELETE FROM club_registrations WHERE club_name LIKE $1", [`${TAG}%`]);
  await query(
    "DELETE FROM club_owners WHERE email LIKE $1",
    [`${TAG}%@example.com`]
  );
  await query("DELETE FROM clubs WHERE slug LIKE $1", [`${TAG}%`]);
  await pool.end();
});

test("creating and assigning an owner links it to exactly that club", async () => {
  const result = await createAndAssignClubOwner(clubAId, {
    email: emailA,
    passwordHash: "scrypt$1$1$1$AA==$AA==",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const club = await findClubByOwnerId(result.owner.id);
  assert.ok(club);
  assert.equal(club!.id, clubAId);

  const withHash = await findClubOwnerByEmailWithHash(emailA);
  assert.ok(withHash);
  assert.equal(withHash!.is_active, true);
});

test("assigning an owner to an already-owned club is refused, atomically", async () => {
  // clubA already has an owner from the previous test.
  const result = await createAndAssignClubOwner(clubAId, {
    email: `${TAG}-should-not-exist@example.com`,
    passwordHash: "scrypt$1$1$1$AA==$AA==",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "clubAlreadyOwned");

  // The half-applied account must not have been created.
  const notCreated = await findClubOwnerByEmailWithHash(
    `${TAG}-should-not-exist@example.com`
  );
  assert.equal(notCreated, null);
});

test("reusing an email for a different club is refused", async () => {
  const result = await createAndAssignClubOwner(clubBId, {
    email: emailA, // already used for clubA's owner
    passwordHash: "scrypt$1$1$1$AA==$AA==",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "emailTaken");

  // clubB must still have no owner — the refused attempt did not partially apply.
  const clubB = await findClubById(clubBId);
  assert.equal(clubB!.owner_id, null);
});

test("unassigning (setClubOwner null) frees the club for a new owner", async () => {
  await setClubOwner(clubAId, null);
  assert.equal(await findClubByOwnerId(clubAId), null);

  const result = await createAndAssignClubOwner(clubAId, {
    email: emailB,
    passwordHash: "scrypt$1$1$1$AA==$AA==",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const club = await findClubByOwnerId(result.owner.id);
  assert.equal(club!.id, clubAId);
});

test("a deactivated owner account no longer resolves as active", async () => {
  const withHash = await findClubOwnerByEmailWithHash(emailB);
  assert.ok(withHash);
  const deactivated = await deactivateClubOwner(withHash!.id);
  assert.equal(deactivated!.is_active, false);
});

/**
 * REQ-REG-004 / task §18 — the registration → approval → club pipeline must
 * never disturb an ownership link that already exists.
 *
 * `approveRegistration` re-publishes an already-linked club rather than
 * creating a second one, and it must leave `clubs.owner_id` exactly as it
 * found it. A regression here would silently orphan a club owner (their
 * `/my-club` would start reporting "no club assigned") the next time an admin
 * re-approved the registration, which is easy to do and hard to notice.
 */
test("approving a registration never clears or overwrites an existing club owner", async () => {
  // clubA is owned by emailA's account from the first test in this file.
  const before = await findClubById(clubAId);
  assert.ok(before?.owner_id, "precondition: club A already has an owner");
  const ownerId = before!.owner_id;

  const [registration] = await query<{ id: number }>(
    `INSERT INTO club_registrations
       (club_name, operating_region, representative_name, representative_email, club_id)
     VALUES ($1, 'Testville', 'Owner Test Rep', $2, $3)
     RETURNING id`,
    [`${TAG} Registration`, `${TAG}-rep@example.com`, clubAId]
  );

  const result = await approveRegistration(registration.id);
  assert.equal(result.kind, "approved");
  if (result.kind !== "approved") return;
  assert.equal(result!.clubId, clubAId, "re-approval reuses the linked club");

  const after = await findClubById(clubAId);
  assert.equal(after!.owner_id, ownerId, "ownership survived approval");
  assert.equal(after!.is_approved, true);

  // A fresh owner session must still resolve to the same club.
  const stillOwned = await findClubByOwnerId(ownerId!);
  assert.equal(stillOwned?.id, clubAId);

  await query("DELETE FROM club_registrations WHERE id = $1", [registration.id]);
});

test("owner unassignment is atomic across club, head coach, and account", async () => {
  const email = `${TAG}-unassign-success@example.com`;
  const [owner] = await query<{ id: number }>(
    `INSERT INTO club_owners (email, full_name, password_hash)
     VALUES ($1, 'Unassign Owner', 'scrypt$1$1$1$AA==$AA==') RETURNING id`,
    [email]
  );
  await query("UPDATE clubs SET owner_id = $2 WHERE id = $1", [clubBId, owner.id]);
  const [headCoach] = await query<{ id: number }>(
    `INSERT INTO club_members (club_id, full_name, member_role, club_owner_id, is_head_coach)
     VALUES ($1, 'Unassign Head Coach', 'coach', $2, TRUE) RETURNING id`,
    [clubBId, owner.id]
  );

  const result = await unassignClubOwner(clubBId);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.club.owner_id, null);

  const club = await findClubById(clubBId);
  const [member] = await query<{ is_head_coach: boolean; club_owner_id: number | null }>(
    "SELECT is_head_coach, club_owner_id FROM club_members WHERE id = $1",
    [headCoach.id]
  );
  const deactivated = await findClubOwnerByEmailWithHash(email);
  assert.equal(club!.owner_id, null);
  assert.equal(member.is_head_coach, false);
  assert.equal(member.club_owner_id, null);
  assert.equal(deactivated!.is_active, false);
});

test("a failed owner unassignment rolls back club and head-coach writes", async () => {
  const email = `${TAG}-unassign-rollback@example.com`;
  const [owner] = await query<{ id: number }>(
    `INSERT INTO club_owners (email, full_name, password_hash)
     VALUES ($1, 'Rollback Owner', 'scrypt$1$1$1$AA==$AA==') RETURNING id`,
    [email]
  );
  await query("UPDATE clubs SET owner_id = $2 WHERE id = $1", [clubBId, owner.id]);
  const [headCoach] = await query<{ id: number }>(
    `INSERT INTO club_members (club_id, full_name, member_role, club_owner_id, is_head_coach)
     VALUES ($1, 'Rollback Head Coach', 'coach', $2, TRUE) RETURNING id`,
    [clubBId, owner.id]
  );

  // Force the final account write to fail. The preceding unlink/demotion must
  // then roll back; the trigger is scoped to this disposable owner and removed
  // in `finally` so it cannot affect other tests.
  const functionName = `test_unassign_rollback_${process.pid}`;
  const triggerName = `test_unassign_rollback_trigger_${process.pid}`;
  try {
    await query(`
      CREATE FUNCTION ${functionName}() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.id = ${owner.id} THEN
          RAISE EXCEPTION 'forced owner unassignment failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER ${triggerName}
        BEFORE UPDATE ON club_owners
        FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);

    await assert.rejects(() => unassignClubOwner(clubBId));
  } finally {
    await query(`DROP TRIGGER IF EXISTS ${triggerName} ON club_owners`);
    await query(`DROP FUNCTION IF EXISTS ${functionName}()`);
  }

  const club = await findClubById(clubBId);
  const [member] = await query<{ is_head_coach: boolean; club_owner_id: number | null }>(
    "SELECT is_head_coach, club_owner_id FROM club_members WHERE id = $1",
    [headCoach.id]
  );
  const stillActive = await findClubOwnerByEmailWithHash(email);
  assert.equal(club!.owner_id, owner.id, "club link was rolled back");
  assert.equal(member.is_head_coach, true, "head-coach flag was rolled back");
  assert.equal(member.club_owner_id, owner.id, "head-coach identity was rolled back");
  assert.equal(stillActive!.is_active, true, "account deactivation did not persist");
});
