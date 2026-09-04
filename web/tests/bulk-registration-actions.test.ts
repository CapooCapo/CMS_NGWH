import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { pool, query } from "../src/server/db/pool";
import { applyBulkRegistrationAction } from "../src/server/services/bulkRegistrationActions";

const TAG = `test-bulk-registration-${process.pid}`;
let pendingA: number;
let pendingB: number;
let rejected: number;
let approved: number;
let conflict: number;
let inactive: number;
let conflictOwner: number;
let inactiveOwner: number;

async function registration(name: string, ownerId?: number) {
  const [row] = await query<{ id: number }>(
    `INSERT INTO club_registrations
       (club_name, operating_region, representative_name, representative_email, club_owner_id)
     VALUES ($1, 'Testville', 'Bulk Tester', $2, $3) RETURNING id`,
    [name, `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`, ownerId ?? null]
  );
  return row.id;
}

before(async () => {
  const [active] = await query<{ id: number }>(
    "INSERT INTO club_owners (email, password_hash) VALUES ($1, 'test') RETURNING id",
    [`${TAG}-conflict@example.com`]
  );
  conflictOwner = active.id;
  const [inactiveOwnerRow] = await query<{ id: number }>(
    "INSERT INTO club_owners (email, password_hash, is_active) VALUES ($1, 'test', FALSE) RETURNING id",
    [`${TAG}-inactive@example.com`]
  );
  inactiveOwner = inactiveOwnerRow.id;
  await query(
    "INSERT INTO clubs (slug, name, province, is_approved, owner_id) VALUES ($1, $2, 'Testville', TRUE, $3)",
    [`${TAG}-owned`, `${TAG} Existing Club`, conflictOwner]
  );

  pendingA = await registration(`${TAG} Pending A`);
  pendingB = await registration(`${TAG} Pending B`);
  rejected = await registration(`${TAG} Rejected`);
  approved = await registration(`${TAG} Approved`);
  conflict = await registration(`${TAG} Conflict`, conflictOwner);
  inactive = await registration(`${TAG} Inactive`, inactiveOwner);
});

after(async () => {
  await query("DELETE FROM club_registrations WHERE club_name LIKE $1", [`${TAG}%`]);
  await query("DELETE FROM clubs WHERE slug LIKE $1", [`${TAG}%`]);
  await query("DELETE FROM club_owners WHERE email LIKE $1", [`${TAG}%`]);
  await pool.end();
});

test("bulk approval delegates each registration to the existing approval service", async () => {
  const results = await applyBulkRegistrationAction([pendingA, pendingB], "approve");
  assert.deepEqual(results, [{ id: pendingA, ok: true }, { id: pendingB, ok: true }]);
  const rows = await query<{ id: number; status: string; club_id: number | null }>(
    "SELECT id, status, club_id FROM club_registrations WHERE id = ANY($1) ORDER BY id",
    [[pendingA, pendingB]]
  );
  assert.deepEqual(rows.map((row) => row.status), ["approved", "approved"]);
  assert.ok(rows.every((row) => row.club_id));
});

test("bulk approval reports independent ownership and inactive-account failures", async () => {
  const results = await applyBulkRegistrationAction([conflict, inactive], "approve");
  assert.deepEqual(results, [
    { id: conflict, ok: false, reason: "ownershipConflict" },
    { id: inactive, ok: false, reason: "registrantUnavailable" },
  ]);
});

test("bulk rejection preserves terminal idempotency and reports opposite transitions", async () => {
  assert.deepEqual(await applyBulkRegistrationAction([rejected], "reject"), [{ id: rejected, ok: true }]);
  assert.deepEqual(await applyBulkRegistrationAction([rejected], "reject"), [{ id: rejected, ok: true }]);
  assert.deepEqual(await applyBulkRegistrationAction([rejected], "approve"), [
    { id: rejected, ok: false, reason: "invalidReviewTransition" },
  ]);
});

test("bulk deletion removes only unapproved registrations and refuses approved ones", async () => {
  await applyBulkRegistrationAction([approved], "approve");
  const results = await applyBulkRegistrationAction([rejected, approved], "delete");
  assert.deepEqual(results, [
    { id: rejected, ok: true },
    { id: approved, ok: false, reason: "deletionNotAllowed" },
  ]);
  assert.equal((await query("SELECT id FROM club_registrations WHERE id = $1", [rejected])).length, 0);
  assert.equal((await query("SELECT id FROM club_registrations WHERE id = $1", [approved])).length, 1);
});
