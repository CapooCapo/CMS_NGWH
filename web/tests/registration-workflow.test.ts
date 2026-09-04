import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { query, pool } from "../src/server/db/pool";

/**
 * The authenticated club-registration workflow, end to end against a running
 * server:
 *
 *   sign up → log in → submit registration (PENDING) → admin approves
 *           → registrant becomes Club Owner **and** Head Coach → My Club
 *
 * Everything is driven through the real HTTP surface, because the point of
 * most of these assertions is *where* the server gets its identity from — a
 * repository-level test could not tell you that the route ignores a
 * client-supplied owner id.
 *
 * Needs the `biz-admin` fixture (see `superadmin-authorization.test.ts`'s
 * header for the `npm run admin:create` invocations) and skips itself when
 * the server or that account is unavailable, so `npm test` still passes
 * without them. Every row it creates is deleted in `after()`.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_USER = process.env.TEST_BIZADMIN_USER ?? "biz-admin";
const ADMIN_PASSWORD = process.env.TEST_BIZADMIN_PASSWORD ?? "test-pass-admin-2026";

const TAG = `test-regwf-${process.pid}`;
const PASSWORD = "regwf-test-pass-2026";

let serverUp = false;
let adminCookie: string | null = null;

function extractCookie(response: Response, name: string): string | null {
  const set = response.headers.getSetCookie?.() ?? [];
  const match = set.find((c) => c.startsWith(`${name}=`));
  return match ? match.split(";")[0] : null;
}

type Account = { email: string; cookie: string; id: number };

/** Creates an account, then signs in through the separate login step. */
async function signUp(suffix: string, fullName: string): Promise<Account | null> {
  const email = `${TAG}-${suffix}@example.com`;
  const response = await fetch(`${BASE}/api/owner/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, fullName, password: PASSWORD }),
  });
  if (response.status !== 201) return null;
  const { owner } = (await response.json()) as { owner: { id: number } };
  const login = await fetch(`${BASE}/api/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = extractCookie(login, "ngwh_owner_session");
  return cookie ? { email, cookie, id: owner.id } : null;
}

function registrationForm(clubName: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("clubName", clubName);
  form.set("operatingRegion", "Testville");
  form.set("representativeName", "Reg WF Tester");
  form.set("representativeEmail", `${TAG}-rep@example.com`);
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return form;
}

async function submitRegistration(account: Account, clubName: string, extra = {}) {
  return fetch(`${BASE}/api/registrations`, {
    method: "POST",
    headers: { Cookie: account.cookie },
    body: registrationForm(clubName, extra),
  });
}

function registrationPage(account: Account, locale = "vi") {
  return fetch(`${BASE}/clubs/register`, {
    headers: { Cookie: `${account.cookie}; NEXT_LOCALE=${locale}` },
  });
}

async function approve(registrationId: number) {
  return review(registrationId, "approved");
}

async function review(
  registrationId: number,
  action: "approved" | "rejected"
) {
  return fetch(`${BASE}/api/admin/registrations/${registrationId}/review`, {
    method: "POST",
    headers: { Cookie: adminCookie!, "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

before(async () => {
  try {
    const probe = await fetch(`${BASE}/api/live`, { signal: AbortSignal.timeout(5000) });
    serverUp = probe.status < 500;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.log("      (server not reachable — suite skipped)");
    return;
  }
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
  });
  adminCookie = extractCookie(login, "ngwh_admin_session");
});

after(async () => {
  // Registrations first: they reference clubs.
  await query("DELETE FROM club_registrations WHERE club_name LIKE $1", [`${TAG}%`]);
  // By slug as well as name: the "cannot self-publish" test deliberately
  // renames its club, and a club matched only by name would survive cleanup.
  // The slug is derived from the original tagged name, so it still matches.
  await query("DELETE FROM clubs WHERE name LIKE $1 OR slug LIKE $2", [
    `${TAG}%`,
    `${TAG}%`,
  ]);
  await query("DELETE FROM club_owners WHERE email LIKE $1", [`${TAG}-%@example.com`]);
  await pool.end();
});

/* ── Authentication ─────────────────────────────────────────────────── */

test("an anonymous visitor cannot submit a club registration", async (t) => {
  if (!serverUp) return t.skip("server not running");

  const response = await fetch(`${BASE}/api/registrations`, {
    method: "POST",
    body: registrationForm(`${TAG} Anonymous Club`),
  });
  assert.equal(response.status, 401);

  // And nothing was written.
  const rows = await query("SELECT id FROM club_registrations WHERE club_name = $1", [
    `${TAG} Anonymous Club`,
  ]);
  assert.equal(rows.length, 0, "a rejected submission must not persist");
});

test("the registration page offers sign-in rather than the form when signed out", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const response = await fetch(`${BASE}/clubs/register`, {
    headers: { Cookie: "NEXT_LOCALE=vi" },
  });
  const html = await response.text();
  assert.ok(
    html.includes("Bạn cần đăng nhập để đăng ký câu lạc bộ."),
    "the required Vietnamese prompt is shown"
  );
  assert.ok(html.includes("/signup"), "a create-account link is offered");
  assert.ok(
    !html.includes('name="clubName"'),
    "the form itself is not rendered to an anonymous visitor"
  );
});

test("signup creates an account, redirects to login, and does not create a session", async (t) => {
  if (!serverUp) return t.skip("server not running");

  const email = `${TAG}-signup@example.com`;
  const signup = await fetch(`${BASE}/api/owner/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, fullName: "Signup Tester", password: PASSWORD }),
  });
  assert.equal(signup.status, 201);
  assert.equal(extractCookie(signup, "ngwh_owner_session"), null, "signup must not log in");
  const body = (await signup.json()) as { redirectTo?: string };
  assert.equal(body.redirectTo, "/login");
  assert.notEqual(body.redirectTo, "/my-club");

  const login = await fetch(`${BASE}/api/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = extractCookie(login, "ngwh_owner_session");
  assert.ok(cookie, "login returned a session");
  assert.equal(((await login.clone().json()) as { redirectTo?: string }).redirectTo, "/clubs");

  const me = await fetch(`${BASE}/api/owner/me`, { headers: { Cookie: cookie! } });
  assert.equal(me.status, 200);

  const duplicate = await fetch(`${BASE}/api/owner/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      fullName: "Someone Else",
      password: PASSWORD,
    }),
  });
  assert.equal(duplicate.status, 409);
});

test("signup grants no club and no staff access", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const account = await signUp("nopriv", "No Privilege");
  assert.ok(account);

  // No club yet — a distinct state, not an authorization failure.
  const club = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: account!.cookie },
  });
  assert.equal(club.status, 404);

  // And absolutely no staff access.
  const admin = await fetch(`${BASE}/api/admin/clubs`, {
    headers: { Cookie: account!.cookie },
  });
  assert.ok([401, 403].includes(admin.status), `admin API rejected (${admin.status})`);
});

/* ── Registration ───────────────────────────────────────────────────── */

test("an authenticated submission is created as PENDING and owned by the session", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const account = await signUp("pending", "Pending Tester");
  assert.ok(account);

  const response = await submitRegistration(account!, `${TAG} Pending Club`);
  assert.equal(response.status, 201);
  const body = (await response.json()) as { id: number; status: string };
  assert.equal(body.status, "pending");

  const [row] = await query<{ club_owner_id: number | null; status: string }>(
    "SELECT club_owner_id, status FROM club_registrations WHERE id = $1",
    [body.id]
  );
  assert.equal(row.status, "pending");
  assert.equal(row.club_owner_id, account!.id, "attributed to the session's account");
});

test("a client-supplied owner id cannot attribute a registration to someone else", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const victim = await signUp("victim", "Victim");
  const attacker = await signUp("attacker", "Attacker");
  assert.ok(victim && attacker);

  // Every plausible spelling of "I am user N", all at once.
  const response = await submitRegistration(attacker!, `${TAG} Spoofed Club`, {
    clubOwnerId: String(victim!.id),
    ownerId: String(victim!.id),
    userId: String(victim!.id),
    club_owner_id: String(victim!.id),
  });
  assert.equal(response.status, 201);
  const { id } = (await response.json()) as { id: number };

  const [row] = await query<{ club_owner_id: number }>(
    "SELECT club_owner_id FROM club_registrations WHERE id = $1",
    [id]
  );
  assert.equal(row.club_owner_id, attacker!.id, "the session wins, not the body");
  assert.notEqual(row.club_owner_id, victim!.id);
});

test("one pending registration per account", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const account = await signUp("dup", "Duplicate Tester");
  assert.ok(account);

  const first = await submitRegistration(account!, `${TAG} First Club`);
  assert.equal(first.status, 201);
  const second = await submitRegistration(account!, `${TAG} Second Club`);
  assert.equal(second.status, 409);
});

test("concurrent registration attempts create only one pending registration", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const account = await signUp("concurrent-pending", "Concurrent Pending Tester");
  assert.ok(account);

  const [first, second] = await Promise.all([
    submitRegistration(account!, `${TAG} Concurrent First Club`),
    submitRegistration(account!, `${TAG} Concurrent Second Club`),
  ]);
  const responses = [first, second].sort((a, b) => a.status - b.status);
  assert.equal(responses[0].status, 201);
  assert.equal(responses[1].status, 409);
  assert.equal(((await responses[1].json()) as { error?: string }).error, "alreadyPending");

  const [count] = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM club_registrations WHERE club_owner_id = $1 AND status = 'pending'",
    [account!.id]
  );
  assert.equal(count.count, "1");
});

test("an owner with a club cannot submit another registration", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const account = await signUp("already-owner", "Existing Owner Tester");
  assert.ok(account);
  const [club] = await query<{ id: number }>(
    `INSERT INTO clubs (slug, name, province, is_approved, owner_id)
     VALUES ($1, $2, 'Testville', TRUE, $3) RETURNING id`,
    [`${TAG}-already-owner-club`, `${TAG} Existing Owner Club`, account!.id]
  );
  const [headCoach] = await query<{ id: number }>(
    `INSERT INTO club_members (club_id, full_name, member_role, club_owner_id, is_head_coach)
     VALUES ($1, 'Existing Owner Tester', 'coach', $2, TRUE) RETURNING id`,
    [club.id, account!.id]
  );

  const blockedName = `${TAG} Blocked Second Club`;
  const response = await submitRegistration(account!, blockedName);
  assert.equal(response.status, 409);
  assert.equal(((await response.json()) as { error?: string }).error, "alreadyOwnsClub");

  const registrations = await query("SELECT id FROM club_registrations WHERE club_name = $1", [
    blockedName,
  ]);
  const [unchangedClub] = await query<{ owner_id: number | null }>(
    "SELECT owner_id FROM clubs WHERE id = $1",
    [club.id]
  );
  const [unchangedHeadCoach] = await query<{
    is_head_coach: boolean;
    club_owner_id: number | null;
  }>("SELECT is_head_coach, club_owner_id FROM club_members WHERE id = $1", [headCoach.id]);
  assert.equal(registrations.length, 0);
  assert.equal(unchangedClub.owner_id, account!.id);
  assert.equal(unchangedHeadCoach.is_head_coach, true);
  assert.equal(unchangedHeadCoach.club_owner_id, account!.id);
});

test("the registration page renders the pending state in the active locale", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const account = await signUp("pending-page", "Pending Page Tester");
  assert.ok(account);

  const submitted = await submitRegistration(account!, `${TAG} Pending Page Club`);
  const { id } = (await submitted.json()) as { id: number };
  const [registration] = await query<{ created_at: string }>(
    `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
       FROM club_registrations WHERE id = $1`,
    [id]
  );
  assert.ok(registration);

  const response = await registrationPage(account!, "en");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes("Your registration is under review"));
  assert.ok(html.includes("Submitted on:"));
  assert.ok(html.includes("Club:"));
  assert.ok(html.includes(new Date(registration.created_at).toLocaleDateString("en")));
  assert.ok(!html.includes('name="clubName"'), "the pending state hides the form");
});

/* ── Approval → Club Owner + Head Coach ─────────────────────────────── */

test("approval makes the registrant the club owner and head coach, atomically", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const account = await signUp("approve", "Nguyen Van Approved");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Approved Club`);
  const { id: registrationId } = (await submitted.json()) as { id: number };

  // Before approval the account manages nothing.
  const before = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: account!.cookie },
  });
  assert.equal(before.status, 404, "no club to manage while pending");

  const review = await approve(registrationId);
  assert.equal(review.status, 200);

  const after = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: account!.cookie },
  });
  assert.equal(after.status, 200, "the club is now theirs");
  const data = (await after.json()) as {
    club: { id: number; name: string };
    members: { id: number; full_name: string; member_role: string; is_head_coach: boolean }[];
  };
  assert.equal(data.club.name, `${TAG} Approved Club`);

  const headCoaches = data.members.filter((m) => m.is_head_coach);
  assert.equal(headCoaches.length, 1, "exactly one head coach");
  assert.equal(headCoaches[0].full_name, "Nguyen Van Approved", "it is the registrant");
  assert.equal(headCoaches[0].member_role, "coach");

  // The ownership link really is in the database, not just in the response.
  const [club] = await query<{ owner_id: number }>(
    "SELECT owner_id FROM clubs WHERE id = $1",
    [data.club.id]
  );
  assert.equal(club.owner_id, account!.id);
});

test("re-approving does not create a second head coach or move ownership", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const account = await signUp("reapprove", "Re Approve");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Reapprove Club`);
  const { id: registrationId } = (await submitted.json()) as { id: number };

  await approve(registrationId);
  await approve(registrationId);

  const response = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: account!.cookie },
  });
  const data = (await response.json()) as {
    club: { id: number };
    members: { is_head_coach: boolean }[];
  };
  assert.equal(data.members.filter((m) => m.is_head_coach).length, 1);

  const [club] = await query<{ owner_id: number }>(
    "SELECT owner_id FROM clubs WHERE id = $1",
    [data.club.id]
  );
  assert.equal(club.owner_id, account!.id);
});

test("review decisions are terminal and same-decision retries preserve their timestamp", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const account = await signUp("terminal-approved", "Terminal Approved Tester");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Terminal Approved Club`);
  const { id } = (await submitted.json()) as { id: number };

  const first = await review(id, "approved");
  assert.equal(first.status, 200);
  const firstBody = (await first.json()) as {
    registration: { review_note: string | null; reviewed_at: string | null };
  };
  const repeat = await review(id, "approved");
  assert.equal(repeat.status, 200);
  const repeatBody = (await repeat.json()) as {
    registration: { review_note: string | null; reviewed_at: string | null };
  };
  assert.equal(firstBody.registration.review_note, null, "review comments are not persisted");
  assert.equal(repeatBody.registration.review_note, null);
  assert.equal(repeatBody.registration.reviewed_at, firstBody.registration.reviewed_at);

  const opposite = await review(id, "rejected");
  assert.equal(opposite.status, 409);
  assert.equal(
    ((await opposite.json()) as { error?: string }).error,
    "invalidReviewTransition"
  );
});

test("a rejected registration cannot be approved and repeated rejection is idempotent", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const account = await signUp("terminal-rejected", "Terminal Rejected Tester");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Terminal Rejected Club`);
  const { id } = (await submitted.json()) as { id: number };

  const first = await review(id, "rejected");
  assert.equal(first.status, 200);
  const firstBody = (await first.json()) as {
    registration: { review_note: string | null; reviewed_at: string | null };
  };
  const repeat = await review(id, "rejected");
  assert.equal(repeat.status, 200);
  const repeatBody = (await repeat.json()) as {
    registration: { review_note: string | null; reviewed_at: string | null };
  };
  assert.equal(firstBody.registration.review_note, null, "review comments are not persisted");
  assert.equal(repeatBody.registration.review_note, null);
  assert.equal(repeatBody.registration.reviewed_at, firstBody.registration.reviewed_at);

  const opposite = await review(id, "approved");
  assert.equal(opposite.status, 409);
  assert.equal(
    ((await opposite.json()) as { error?: string }).error,
    "invalidReviewTransition"
  );
});

test("concurrent matching and opposing reviews serialize through the registration lock", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const approveAccount = await signUp("concurrent-approve", "Concurrent Approve Tester");
  assert.ok(approveAccount);
  const approveSubmitted = await submitRegistration(
    approveAccount!,
    `${TAG} Concurrent Approve Club`
  );
  const { id: approveId } = (await approveSubmitted.json()) as { id: number };
  const approved = await Promise.all([
    review(approveId, "approved"),
    review(approveId, "approved"),
  ]);
  assert.deepEqual(approved.map((response) => response.status).sort(), [200, 200]);
  const [headCoachCount] = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM club_members m
     JOIN club_registrations r ON r.club_id = m.club_id
     WHERE r.id = $1 AND m.is_head_coach`,
    [approveId]
  );
  assert.equal(headCoachCount.count, "1");

  const rejectAccount = await signUp("concurrent-reject", "Concurrent Reject Tester");
  assert.ok(rejectAccount);
  const rejectSubmitted = await submitRegistration(
    rejectAccount!,
    `${TAG} Concurrent Reject Club`
  );
  const { id: rejectId } = (await rejectSubmitted.json()) as { id: number };
  const rejected = await Promise.all([
    review(rejectId, "rejected"),
    review(rejectId, "rejected"),
  ]);
  assert.deepEqual(rejected.map((response) => response.status).sort(), [200, 200]);

  const mixedAccount = await signUp("concurrent-mixed", "Concurrent Mixed Tester");
  assert.ok(mixedAccount);
  const mixedSubmitted = await submitRegistration(mixedAccount!, `${TAG} Concurrent Mixed Club`);
  const { id: mixedId } = (await mixedSubmitted.json()) as { id: number };
  const mixed = await Promise.all([
    review(mixedId, "approved"),
    review(mixedId, "rejected"),
  ]);
  assert.deepEqual(mixed.map((response) => response.status).sort(), [200, 409]);
  const conflict = mixed.find((response) => response.status === 409)!;
  assert.equal(
    ((await conflict.json()) as { error?: string }).error,
    "invalidReviewTransition"
  );
});

test("approval refuses inactive or already-assigned registrants without changing ownership", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const inactive = await signUp("inactive-approval", "Inactive Approval Tester");
  assert.ok(inactive);
  const inactiveName = `${TAG} Inactive Approval Club`;
  const inactiveSubmitted = await submitRegistration(inactive!, inactiveName);
  const { id: inactiveId } = (await inactiveSubmitted.json()) as { id: number };
  await query("UPDATE club_owners SET is_active = FALSE WHERE id = $1", [inactive!.id]);
  const inactiveReview = await review(inactiveId, "approved");
  assert.equal(inactiveReview.status, 409);
  assert.equal(
    ((await inactiveReview.json()) as { error?: string }).error,
    "registrantUnavailable"
  );
  const [inactiveRegistration] = await query<{ status: string }>(
    "SELECT status FROM club_registrations WHERE id = $1",
    [inactiveId]
  );
  const inactiveClubs = await query("SELECT id FROM clubs WHERE name = $1", [inactiveName]);
  assert.equal(inactiveRegistration.status, "pending");
  assert.equal(inactiveClubs.length, 0);

  const conflictOwner = await signUp("ownership-conflict", "Ownership Conflict Tester");
  assert.ok(conflictOwner);
  const [clubA] = await query<{ id: number }>(
    `INSERT INTO clubs (slug, name, province, is_approved, owner_id)
     VALUES ($1, $2, 'Testville', TRUE, $3) RETURNING id`,
    [`${TAG}-ownership-conflict-a`, `${TAG} Ownership Conflict A`, conflictOwner!.id]
  );
  const [headCoach] = await query<{ id: number }>(
    `INSERT INTO club_members (club_id, full_name, member_role, club_owner_id, is_head_coach)
     VALUES ($1, 'Ownership Conflict Tester', 'coach', $2, TRUE) RETURNING id`,
    [clubA.id, conflictOwner!.id]
  );
  const [pendingRegistration] = await query<{ id: number }>(
    `INSERT INTO club_registrations
       (club_name, operating_region, representative_name, representative_email, club_owner_id)
     VALUES ($1, 'Testville', 'Ownership Conflict Tester', $2, $3) RETURNING id`,
    [`${TAG} Ownership Conflict B`, `${TAG}-ownership-conflict@example.com`, conflictOwner!.id]
  );
  const conflictReview = await review(pendingRegistration.id, "approved");
  assert.equal(conflictReview.status, 409);
  assert.equal(
    ((await conflictReview.json()) as { error?: string }).error,
    "ownershipConflict"
  );
  const [unchangedClub] = await query<{ owner_id: number | null }>(
    "SELECT owner_id FROM clubs WHERE id = $1",
    [clubA.id]
  );
  const [unchangedHeadCoach] = await query<{
    is_head_coach: boolean;
    club_owner_id: number | null;
  }>("SELECT is_head_coach, club_owner_id FROM club_members WHERE id = $1", [headCoach.id]);
  const [stillPending] = await query<{ status: string }>(
    "SELECT status FROM club_registrations WHERE id = $1",
    [pendingRegistration.id]
  );
  assert.equal(unchangedClub.owner_id, conflictOwner!.id);
  assert.equal(unchangedHeadCoach.is_head_coach, true);
  assert.equal(unchangedHeadCoach.club_owner_id, conflictOwner!.id);
  assert.equal(stillPending.status, "pending");
});

test("rejection grants nothing and lets the applicant re-apply", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const account = await signUp("reject", "Rejected Applicant");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Rejected Club`);
  const { id: registrationId } = (await submitted.json()) as { id: number };

  const review = await fetch(`${BASE}/api/admin/registrations/${registrationId}/review`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rejected" }),
  });
  assert.equal(review.status, 200);

  const club = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: account!.cookie },
  });
  assert.equal(club.status, 404, "a rejected applicant owns nothing");

  // The pending-uniqueness index excludes rejected rows, so re-applying works.
  const again = await submitRegistration(account!, `${TAG} Retry Club`);
  assert.equal(again.status, 201);
});

test("the registration page lets a rejected owner re-apply without a reviewer note", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");
  const account = await signUp("rejected-page", "Rejected Page Tester");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Rejected Page Club`);
  const { id } = (await submitted.json()) as { id: number };
  const review = await fetch(`${BASE}/api/admin/registrations/${id}/review`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rejected" }),
  });
  assert.equal(review.status, 200);

  const response = await registrationPage(account!, "en");
  const html = await response.text();
  assert.ok(!html.includes("Review note:"));
  assert.ok(html.includes('name="clubName"'), "the rejected state offers the form again");
});

test("the registration page directs an approved owner to their club detail", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");
  const account = await signUp("approved-page", "Approved Page Tester");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Approved Page Club`);
  const { id } = (await submitted.json()) as { id: number };
  const review = await approve(id);
  assert.equal(review.status, 200);

  const response = await registrationPage(account!, "en");
  const html = await response.text();
  assert.ok(html.includes("Your registration has been approved"));
  assert.match(html, /href="\/my-clubs\/\d+"/);
  assert.ok(html.includes("Manage my club"));
  assert.ok(!html.includes('name="clubName"'), "an approved owner cannot re-submit");
});

/* ── The head-coach row is the owner's identity ─────────────────────── */

test("the head-coach row cannot be deleted by the owner", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const account = await signUp("headcoach", "Head Coach Owner");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Head Coach Club`);
  const { id: registrationId } = (await submitted.json()) as { id: number };
  await approve(registrationId);

  const read = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: account!.cookie },
  });
  const { members } = (await read.json()) as {
    members: { id: number; is_head_coach: boolean }[];
  };
  const head = members.find((m) => m.is_head_coach)!;

  const removed = await fetch(`${BASE}/api/owner/club/members/${head.id}`, {
    method: "DELETE",
    headers: { Cookie: account!.cookie },
  });
  assert.equal(removed.status, 409, "refused, and specifically — not a 404");

  // Renaming it is still allowed: it is their own name.
  const renamed = await fetch(`${BASE}/api/owner/club/members/${head.id}`, {
    method: "PATCH",
    headers: { Cookie: account!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Renamed Head Coach", memberRole: "player" }),
  });
  assert.equal(renamed.status, 200);
  const { member } = (await renamed.json()) as {
    member: { full_name: string; member_role: string; is_head_coach: boolean };
  };
  assert.equal(member.full_name, "Renamed Head Coach");
  assert.equal(member.member_role, "coach", "cannot be demoted out of the coach role");
  assert.equal(member.is_head_coach, true);
});

/* ── Ownership authorization ────────────────────────────────────────── */

test("an approved owner cannot touch another approved owner's club", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const a = await signUp("owner-a", "Owner A");
  const b = await signUp("owner-b", "Owner B");
  assert.ok(a && b);

  const subA = await submitRegistration(a!, `${TAG} Club A`);
  const subB = await submitRegistration(b!, `${TAG} Club B`);
  await approve(((await subA.json()) as { id: number }).id);
  await approve(((await subB.json()) as { id: number }).id);

  const readB = await fetch(`${BASE}/api/owner/club`, { headers: { Cookie: b!.cookie } });
  const dataB = (await readB.json()) as {
    club: { id: number; name: string };
    members: { id: number }[];
  };
  assert.equal(dataB.club.name, `${TAG} Club B`);

  // A reads only their own club, whatever B's ids are.
  const readA = await fetch(`${BASE}/api/owner/club`, { headers: { Cookie: a!.cookie } });
  const dataA = (await readA.json()) as { club: { id: number; name: string } };
  assert.equal(dataA.club.name, `${TAG} Club A`);
  assert.notEqual(dataA.club.id, dataB.club.id);

  // A cannot edit or delete B's roster members.
  for (const member of dataB.members) {
    const patched = await fetch(`${BASE}/api/owner/club/members/${member.id}`, {
      method: "PATCH",
      headers: { Cookie: a!.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "HIJACKED", memberRole: "player" }),
    });
    assert.ok([403, 404].includes(patched.status), `PATCH denied (${patched.status})`);

    const deleted = await fetch(`${BASE}/api/owner/club/members/${member.id}`, {
      method: "DELETE",
      headers: { Cookie: a!.cookie },
    });
    assert.ok([403, 404].includes(deleted.status), `DELETE denied (${deleted.status})`);
  }

  // B's data is untouched.
  const [{ count }] = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM club_members WHERE club_id = $1 AND full_name = 'HIJACKED'",
    [dataB.club.id]
  );
  assert.equal(count, "0");
});

test("an owner cannot self-publish or rename their club's URL", async (t) => {
  if (!serverUp) return t.skip("server not running");
  if (!adminCookie) return t.skip("biz-admin fixture unavailable");

  const account = await signUp("nosmuggle", "No Smuggle");
  assert.ok(account);
  const submitted = await submitRegistration(account!, `${TAG} Smuggle Club`);
  await approve(((await submitted.json()) as { id: number }).id);

  const before = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: account!.cookie },
  });
  const { club } = (await before.json()) as {
    club: { id: number; slug: string; is_approved: boolean };
  };

  const patched = await fetch(`${BASE}/api/owner/club`, {
    method: "PATCH",
    headers: { Cookie: account!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Renamed By Owner",
      province: "Testville",
      slug: "owner-chosen-slug",
      isApproved: false,
      ownerId: 1,
    }),
  });
  assert.equal(patched.status, 200);

  const [row] = await query<{ slug: string; is_approved: boolean; owner_id: number }>(
    "SELECT slug, is_approved, owner_id FROM clubs WHERE id = $1",
    [club.id]
  );
  assert.equal(row.slug, club.slug, "slug unchanged");
  assert.equal(row.is_approved, club.is_approved, "publish state unchanged");
  assert.equal(row.owner_id, account!.id, "ownership unchanged");
});

/* ── Field validation and uploads, with a session ───────────────────── */

/**
 * These moved here from `api-authorization.test.ts` when the endpoint became
 * authenticated: exercising the validation rules now requires a session, and
 * that file's job is the anonymous surface.
 */
test("an authenticated submission still has every field validated", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const account = await signUp("validate", "Validation Tester");
  assert.ok(account);

  const form = new FormData();
  form.set("clubName", "X"); // too short, and the rest missing
  const response = await fetch(`${BASE}/api/registrations`, {
    method: "POST",
    headers: { Cookie: account!.cookie },
    body: form,
  });
  assert.equal(response.status, 400);
  const body = (await response.json()) as { fields?: Record<string, string> };
  assert.equal(body.fields?.operatingRegion, "required");
  assert.equal(body.fields?.representativeName, "required");
});

test("an authenticated submission still rejects a disallowed upload type", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const account = await signUp("upload", "Upload Tester");
  assert.ok(account);

  const form = registrationForm(`${TAG} Upload Club`);
  form.append(
    "documents",
    new File(["<script>alert(1)</script>"], "evil.html", { type: "text/html" })
  );
  const response = await fetch(`${BASE}/api/registrations`, {
    method: "POST",
    headers: { Cookie: account!.cookie },
    body: form,
  });
  assert.equal(response.status, 400);
  assert.equal(
    ((await response.json()) as { fields?: Record<string, string> }).fields?.documents,
    "fileType"
  );
});
