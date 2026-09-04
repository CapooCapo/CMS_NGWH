import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { query, pool } from "../src/server/db/pool";
import {
  findPublicClubDocument,
  listPublicClubDocuments,
  setDocumentVisibility,
  listRegistrationDocumentsForClub,
  findRegistrationDocumentForClub,
} from "../src/server/repositories/registrations";

/**
 * Club approval controls public document visibility. The legacy `is_public`
 * flag must not hide documents linked to an approved club; document ownership
 * remains scoped through `club_registrations.club_id`.
 */
const TAG = `test-pubdocs-${process.pid}`;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let clubId: number;
let otherClubId: number;
let registrationId: number;
let documentId: number;
let pendingClubId: number;
let rejectedClubId: number;
let pendingDocumentId: number;
let rejectedDocumentId: number;

before(async () => {
  const [club] = await query<{ id: number }>(
    `INSERT INTO clubs (slug, name, province, is_approved) VALUES ($1, 'Test Club', 'Testville', TRUE) RETURNING id`,
    [TAG]
  );
  clubId = club.id;

  const [otherClub] = await query<{ id: number }>(
    `INSERT INTO clubs (slug, name, province, is_approved) VALUES ($1, 'Other Test Club', 'Testville', TRUE) RETURNING id`,
    [`${TAG}-other`]
  );
  otherClubId = otherClub.id;

  const [registration] = await query<{ id: number }>(
    `INSERT INTO club_registrations
       (club_name, operating_region, representative_name, representative_email, status, club_id)
     VALUES ($1, 'Testville', 'Tester', 'tester@example.com', 'approved', $2) RETURNING id`,
    [TAG, clubId]
  );
  registrationId = registration.id;

  const [doc] = await query<{ id: number }>(
    `INSERT INTO registration_documents (registration_id, filename, content_type, byte_size, content)
     VALUES ($1, 'capability-profile.pdf', 'application/pdf', 4, $2) RETURNING id`,
    [registrationId, Buffer.from("test")]
  );
  documentId = doc.id;

  const [pendingClub] = await query<{ id: number }>(
    `INSERT INTO clubs (slug, name, province, is_approved) VALUES ($1, 'Pending Club', 'Testville', FALSE) RETURNING id`,
    [`${TAG}-pending`]
  );
  pendingClubId = pendingClub.id;
  const [rejectedClub] = await query<{ id: number }>(
    `INSERT INTO clubs (slug, name, province, is_approved) VALUES ($1, 'Rejected Club', 'Testville', FALSE) RETURNING id`,
    [`${TAG}-rejected`]
  );
  rejectedClubId = rejectedClub.id;
  for (const [status, clubId] of [["pending", pendingClubId], ["rejected", rejectedClubId]] as const) {
    const [registration] = await query<{ id: number }>(
      `INSERT INTO club_registrations
         (club_name, operating_region, representative_name, representative_email, status, club_id)
       VALUES ($1, 'Testville', 'Tester', $2, $3, $4) RETURNING id`,
      [`${TAG} ${status}`, `${status}@example.com`, status, clubId]
    );
    const [doc] = await query<{ id: number }>(
      `INSERT INTO registration_documents (registration_id, filename, content_type, byte_size, content)
       VALUES ($1, $2, 'application/pdf', 4, $3) RETURNING id`,
      [registration.id, `${status}.pdf`, Buffer.from("test")]
    );
    if (status === "pending") pendingDocumentId = doc.id;
    else rejectedDocumentId = doc.id;
  }
});

after(async () => {
  await query("DELETE FROM club_registrations WHERE id = $1", [registrationId]);
  await query("DELETE FROM clubs WHERE slug LIKE $1", [`${TAG}%`]);
  await pool.end();
});

test("an approved club exposes documents even when the legacy flag is false", async () => {
  const publicDocs = await listPublicClubDocuments(clubId);
  assert.equal(publicDocs.length, 1);
  assert.equal(publicDocs[0].filename, "capability-profile.pdf");
  const found = await findPublicClubDocument(clubId, documentId);
  assert.ok(found);
  assert.equal(found!.filename, "capability-profile.pdf");
  assert.deepEqual(found!.content, Buffer.from("test"));
});

test("the legacy visibility flag does not affect approved-club documents or cross-club scoping", async () => {
  const updated = await setDocumentVisibility(registrationId, documentId, true);
  assert.ok(updated);
  assert.equal(updated!.is_public, true);

  const publicDocs = await listPublicClubDocuments(clubId);
  assert.equal(publicDocs.length, 1);
  assert.equal(publicDocs[0].filename, "capability-profile.pdf");

  const found = await findPublicClubDocument(clubId, documentId);
  assert.ok(found);
  assert.equal(found!.filename, "capability-profile.pdf");

  // A different club's id must not resolve the same document — the join is
  // scoped by `club_registrations.club_id`, not just `is_public`.
  const wrongClub = await findPublicClubDocument(otherClubId, documentId);
  assert.equal(wrongClub, null);
  assert.equal((await listPublicClubDocuments(otherClubId)).length, 0);
});

test("clearing the legacy flag does not hide an approved-club document", async () => {
  await setDocumentVisibility(registrationId, documentId, true);
  assert.equal((await listPublicClubDocuments(clubId)).length, 1);

  const updated = await setDocumentVisibility(registrationId, documentId, false);
  assert.equal(updated!.is_public, false);
  assert.equal((await listPublicClubDocuments(clubId)).length, 1);
  assert.ok(await findPublicClubDocument(clubId, documentId));
});

test("pending and rejected club documents remain private", async () => {
  assert.deepEqual(await listPublicClubDocuments(pendingClubId), []);
  assert.deepEqual(await listPublicClubDocuments(rejectedClubId), []);
  assert.equal(await findPublicClubDocument(pendingClubId, pendingDocumentId), null);
  assert.equal(await findPublicClubDocument(rejectedClubId, rejectedDocumentId), null);
});

test("the public download streams approved documents and keeps club boundaries", async (t) => {
  let response: Response;
  try {
    response = await fetch(`${BASE}/api/clubs/${TAG}/documents/${documentId}`, {
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return t.skip("server not running");
  }
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition") ?? "", /capability-profile\.pdf/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from("test"));

  const otherClub = await fetch(`${BASE}/api/clubs/${TAG}-other/documents/${documentId}`);
  assert.equal(otherClub.status, 404);
  const pendingClub = await fetch(`${BASE}/api/clubs/${TAG}-pending/documents/${pendingDocumentId}`);
  assert.equal(pendingClub.status, 404);
});

test("setDocumentVisibility scoped by registration id, like the download route", async () => {
  const wrongRegistration = await setDocumentVisibility(-1, documentId, true);
  assert.equal(wrongRegistration, null);
});

/**
 * Task §16 — the Club Owner document view. `/api/owner/club/documents/[id]`
 * resolves the club from the session (never from the URL) and then calls
 * these two functions, so their club scoping *is* the ownership boundary:
 * owner A must see their own club's documents (private ones included, since
 * they are that club's own paperwork) and must resolve nothing at all for a
 * document id belonging to another club.
 */
test("an owner's document listing includes their own private documents", async () => {
  // Reset to private so this does not depend on the preceding tests' order.
  await setDocumentVisibility(registrationId, documentId, false);

  const ownDocs = await listRegistrationDocumentsForClub(clubId);
  assert.equal(ownDocs.length, 1);
  assert.equal(ownDocs[0].id, documentId);
  assert.equal(ownDocs[0].is_public, false, "still private, but visible to its own club");

  const found = await findRegistrationDocumentForClub(clubId, documentId);
  assert.ok(found, "the owning club can fetch its own private document");
  assert.equal(found!.filename, "capability-profile.pdf");
});

test("another club's owner resolves nothing for the same document id", async () => {
  const otherDocs = await listRegistrationDocumentsForClub(otherClubId);
  assert.equal(otherDocs.length, 0, "club B lists none of club A's documents");

  // The id is real and the document exists — it simply belongs to another
  // club, which is exactly the case the route turns into a 404.
  const leaked = await findRegistrationDocumentForClub(otherClubId, documentId);
  assert.equal(leaked, null);

  // Publishing it does not change the answer: visibility is a public-page
  // concern, not a cross-owner access grant.
  await setDocumentVisibility(registrationId, documentId, true);
  assert.equal(await findRegistrationDocumentForClub(otherClubId, documentId), null);
});
