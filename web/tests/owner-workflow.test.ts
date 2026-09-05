import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { query, pool } from "../src/server/db/pool";

/**
 * Live authorization tests for the Club Owner workflow, against a running
 * server. Two disposable clubs and Club Owner accounts are created through
 * the real HTTP API (as `biz-admin` — see `superadmin-authorization.test.ts`'s
 * header for how that fixture is bootstrapped) so the suite is fully
 * self-contained: no manual owner-account setup step is required. Everything
 * created here is deleted in `after()`. Skips itself if the server or the
 * `biz-admin` fixture is unavailable, so `npm test` still passes without them.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_USER = process.env.TEST_BIZADMIN_USER ?? "biz-admin";
const ADMIN_PASSWORD = process.env.TEST_BIZADMIN_PASSWORD ?? "test-pass-admin-2026";

const TAG = `test-ownerwf-${process.pid}`;

let serverUp = false;
let adminCookie: string | null = null;

type Fixture = {
  clubId: number;
  slug: string;
  email: string;
  password: string;
  ownerId: number;
  cookie: string;
  achievementsEn: string;
  achievementsVi: string;
};
let clubA: Fixture | null = null;
let clubB: Fixture | null = null;

function extractCookie(response: Response, name: string): string | null {
  const set = response.headers.getSetCookie?.() ?? [];
  const match = set.find((c) => c.startsWith(`${name}=`));
  return match ? match.split(";")[0] : null;
}

async function createClubWithOwner(suffix: string): Promise<Fixture | null> {
  if (!adminCookie) return null;
  const clubRes = await fetch(`${BASE}/api/admin/clubs`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: `${TAG}-${suffix}`,
      name: `Owner WF Club ${suffix.toUpperCase()}`,
      province: "Testville",
      isApproved: true,
    }),
  });
  if (!clubRes.ok) return null;
  const { club } = (await clubRes.json()) as { club: { id: number; slug: string } };

  const email = `${TAG}-${suffix}@example.com`;
  const password = `owner-test-pass-${suffix}-2026!`;
  const achievementsEn = `Champions ${suffix.toUpperCase()} 2025`;
  const achievementsVi = `Vô địch ${suffix.toUpperCase()} năm 2025`;
  const achievementRes = await fetch(`${BASE}/api/admin/clubs/${club.id}`, {
    method: "PATCH",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: club.slug,
      name: `Owner WF Club ${suffix.toUpperCase()}`,
      province: "Testville",
      achievementsEn,
      achievementsVi,
      isApproved: true,
    }),
  });
  if (!achievementRes.ok) return null;
  const ownerRes = await fetch(`${BASE}/api/admin/clubs/${club.id}/owner`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!ownerRes.ok) return null;
  const { owner } = (await ownerRes.json()) as { owner: { id: number } };

  const loginRes = await fetch(`${BASE}/api/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = extractCookie(loginRes, "ngwh_owner_session");
  if (!cookie) return null;

  return {
    clubId: club.id,
    slug: club.slug,
    email,
    password,
    ownerId: owner.id,
    cookie,
    achievementsEn,
    achievementsVi,
  };
}

before(async () => {
  try {
    const probe = await fetch(`${BASE}/api/live`, { signal: AbortSignal.timeout(5000) });
    serverUp = probe.status < 500;
  } catch {
    serverUp = false;
  }
  if (!serverUp) return;

  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
  });
  adminCookie = extractCookie(loginRes, "ngwh_admin_session");
  if (!adminCookie) return;

  clubA = await createClubWithOwner("a");
  clubB = await createClubWithOwner("b");
});

after(async () => {
  if (!serverUp) {
    console.log("      (server not reachable — owner workflow suite skipped)");
  } else if (!adminCookie) {
    console.log("      (biz-admin fixture unavailable — owner workflow suite skipped)");
  }
  // There is no admin "delete club" HTTP endpoint (by design — clubs are only
  // ever unpublished, never deleted, through the product API), so the fixture
  // rows this suite created are removed directly, the same way the other
  // DB-backed suites (`standings.test.ts`, `public-club-documents.test.ts`)
  // clean up. `clubs.owner_id` is `ON DELETE SET NULL`, so the delete order
  // does not matter; `club_members` cascades from the club.
  await query("DELETE FROM clubs WHERE slug LIKE $1", [`${TAG}-%`]);
  await query("DELETE FROM club_owners WHERE email LIKE $1", [`${TAG}-%@example.com`]);
  await pool.end();
});

const ready = () => serverUp && clubA && clubB;

test("every /api/owner/* endpoint rejects an unauthenticated caller with 401", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const endpoints: [string, string][] = [
    ["GET", "/api/owner/me"],
    ["PATCH", "/api/owner/profile"],
    ["GET", "/api/owner/club"],
    ["PATCH", "/api/owner/club"],
    ["GET", "/api/owner/clubs"],
    ["GET", "/api/owner/clubs/1"],
    ["PATCH", "/api/owner/clubs/1"],
    ["DELETE", "/api/owner/clubs/1"],
    ["DELETE", "/api/owner/clubs/1/deletion-request"],
    ["POST", "/api/owner/club/members"],
    ["PATCH", "/api/owner/club/members/1"],
    ["DELETE", "/api/owner/club/members/1"],
    ["GET", "/api/owner/club/documents/1"],
  ];
  for (const [method, path] of endpoints) {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : "{}",
    });
    assert.equal(response.status, 401, `${method} ${path} returned ${response.status}`);
  }
});

test("/my-club redirects an unauthenticated visitor to /login", async (t) => {
  if (!serverUp) return t.skip("server not running");
  const response = await fetch(`${BASE}/my-club`, { redirect: "manual" });
  assert.ok([302, 307, 308].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /\/login/);
});

test("/my-clubs renders the owner's PostgreSQL approval timestamp without an invalid date", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const [timestamp] = await query<{ approved_at: string }>(
    `SELECT to_char(approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS approved_at
       FROM clubs WHERE id = $1`,
    [clubA!.clubId]
  );
  assert.ok(timestamp);
  assert.equal(Number.isNaN(new Date(timestamp.approved_at).getTime()), false);

  const response = await fetch(`${BASE}/my-clubs`, { headers: { Cookie: clubA!.cookie } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes("Owner WF Club A"));
});

test("an owner session can read only its own club through the scoped workspace APIs", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const response = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: clubA!.cookie },
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { club: { id: number; slug: string } };
  assert.equal(body.club.id, clubA!.clubId);
  assert.equal(body.club.slug, clubA!.slug);

  const list = await fetch(`${BASE}/api/owner/clubs`, { headers: { Cookie: clubA!.cookie } });
  assert.equal(list.status, 200);
  const workspace = (await list.json()) as { clubs: { id: number }[]; registrations: unknown[] };
  assert.deepEqual(workspace.clubs.map((club) => club.id), [clubA!.clubId]);

  const ownDetail = await fetch(`${BASE}/api/owner/clubs/${clubA!.clubId}`, {
    headers: { Cookie: clubA!.cookie },
  });
  assert.equal(ownDetail.status, 200);

  const otherDetail = await fetch(`${BASE}/api/owner/clubs/${clubB!.clubId}`, {
    headers: { Cookie: clubA!.cookie },
  });
  assert.equal(otherDetail.status, 404, "another owner's club is not discoverable");
});

test("an owner cannot update or request deletion of another owner's club", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const patch = await fetch(`${BASE}/api/owner/clubs/${clubB!.clubId}`, {
    method: "PATCH",
    headers: { Cookie: clubA!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Hijacked",
      province: "Nowhere",
      socialLinks: { facebook: "https://facebook.example.com/hijacked" },
    }),
  });
  assert.equal(patch.status, 404);

  const remove = await fetch(`${BASE}/api/owner/clubs/${clubB!.clubId}`, {
    method: "DELETE",
    headers: { Cookie: clubA!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
  assert.equal(remove.status, 404);
});

test("an owner can request then cancel a club deletion", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  for (const confirmation of ["delete", "Delete", "", " DELETE"]) {
    const response = await fetch(`${BASE}/api/owner/clubs/${clubA!.clubId}`, {
      method: "DELETE",
      headers: { Cookie: clubA!.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    assert.equal(response.status, 400, `${JSON.stringify(confirmation)} is not confirmation`);
  }

  const confirmed = await fetch(`${BASE}/api/owner/clubs/${clubA!.clubId}`, {
    method: "DELETE",
    headers: { Cookie: clubA!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
  assert.equal(confirmed.status, 201);

  const requested = await fetch(`${BASE}/api/owner/clubs/${clubA!.clubId}`, {
    headers: { Cookie: clubA!.cookie },
  });
  const requestedBody = (await requested.json()) as { club: { deletion_requested_at: string | null } };
  assert.ok(requestedBody.club.deletion_requested_at);

  const cancelled = await fetch(`${BASE}/api/owner/clubs/${clubA!.clubId}/deletion-request`, {
    method: "DELETE",
    headers: { Cookie: clubA!.cookie },
  });
  assert.equal(cancelled.status, 200);

  const remains = await fetch(`${BASE}/api/owner/clubs/${clubA!.clubId}`, {
    headers: { Cookie: clubA!.cookie },
  });
  const remainingBody = (await remains.json()) as { club: { deletion_requested_at: string | null } };
  assert.equal(remainingBody.club.deletion_requested_at, null);
});

test("an authenticated owner can open their account profile", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const response = await fetch(`${BASE}/profile`, { headers: { Cookie: clubA!.cookie } });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /My Profile|Hồ sơ của tôi/);
});

test("an owner persists every supported social link, while slug/isApproved remain protected", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const response = await fetch(`${BASE}/api/owner/club`, {
    method: "PATCH",
    headers: { Cookie: clubA!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Owner WF Club A — edited",
      province: "Edited Province",
      contactPhone: "0900112277",
      socialLinks: {
        facebook: "https://facebook.example.com/owner-wf",
        instagram: "https://instagram.example.com/owner-wf",
        youtube: "https://youtube.example.com/owner-wf",
        tiktok: "https://tiktok.example.com/@owner-wf",
      },
      slug: "hijacked-slug",
      isApproved: false,
    }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    club: {
      name: string;
      province: string;
      slug: string;
      is_approved: boolean;
      social_links: Record<string, string>;
      achievements_en: string | null;
      achievements_vi: string | null;
    };
  };
  assert.equal(body.club.name, "Owner WF Club A — edited");
  assert.equal(body.club.province, "Edited Province");
  assert.equal(body.club.slug, clubA!.slug, "slug must be unchanged");
  assert.equal(body.club.is_approved, true, "isApproved must be unchanged");
  assert.equal(body.club.achievements_en, clubA!.achievementsEn);
  assert.equal(body.club.achievements_vi, clubA!.achievementsVi);
  assert.deepEqual(body.club.social_links, {
    facebook: "https://facebook.example.com/owner-wf",
    instagram: "https://instagram.example.com/owner-wf",
    youtube: "https://youtube.example.com/owner-wf",
    tiktok: "https://tiktok.example.com/@owner-wf",
  });

  const reloaded = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: clubA!.cookie },
  });
  assert.equal(reloaded.status, 200);
  const afterReload = (await reloaded.json()) as {
    club: { social_links: Record<string, string> };
  };
  assert.deepEqual(afterReload.club.social_links, body.club.social_links);
});

test("public club profiles select each achievement locale and fall back to the original", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");

  const english = await fetch(`${BASE}/clubs/${clubA!.slug}`, {
    headers: { Cookie: "NEXT_LOCALE=en" },
  });
  assert.equal(english.status, 200);
  const englishHtml = await english.text();
  assert.match(englishHtml, new RegExp(clubA!.achievementsEn));

  const vietnamese = await fetch(`${BASE}/clubs/${clubA!.slug}`, {
    headers: { Cookie: "NEXT_LOCALE=vi" },
  });
  assert.equal(vietnamese.status, 200);
  const vietnameseHtml = await vietnamese.text();
  assert.match(vietnameseHtml, new RegExp(clubA!.achievementsVi));

  const fallbackAchievement = "English original without a Vietnamese translation";
  const removeTranslation = await fetch(`${BASE}/api/admin/clubs/${clubB!.clubId}`, {
    method: "PATCH",
    headers: { Cookie: adminCookie!, "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: clubB!.slug,
      name: "Owner WF Club B",
      province: "Testville",
      achievementsEn: fallbackAchievement,
      achievementsVi: null,
      isApproved: true,
    }),
  });
  assert.equal(removeTranslation.status, 200);
  const fallbackPage = await fetch(`${BASE}/clubs/${clubB!.slug}`, {
    headers: { Cookie: "NEXT_LOCALE=vi" },
  });
  assert.equal(fallbackPage.status, 200);
  assert.match(await fallbackPage.text(), new RegExp(fallbackAchievement));
});

test("full roster CRUD for an owner's own club", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const create = await fetch(`${BASE}/api/owner/club/members`, {
    method: "POST",
    headers: { Cookie: clubA!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Test Athlete", memberRole: "player", shirtNumber: 7 }),
  });
  assert.equal(create.status, 201);
  const { member } = (await create.json()) as { member: { id: number } };

  const edit = await fetch(`${BASE}/api/owner/club/members/${member.id}`, {
    method: "PATCH",
    headers: { Cookie: clubA!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Test Athlete Edited", memberRole: "player", shirtNumber: 9 }),
  });
  assert.equal(edit.status, 200);
  const edited = (await edit.json()) as { member: { full_name: string; shirt_number: number } };
  assert.equal(edited.member.full_name, "Test Athlete Edited");
  assert.equal(edited.member.shirt_number, 9);

  const del = await fetch(`${BASE}/api/owner/club/members/${member.id}`, {
    method: "DELETE",
    headers: { Cookie: clubA!.cookie },
  });
  assert.equal(del.status, 200);
});

test("Owner A cannot edit or delete Owner B's club member (404, not a cross-club edit)", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const create = await fetch(`${BASE}/api/owner/club/members`, {
    method: "POST",
    headers: { Cookie: clubB!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Club B Athlete", memberRole: "player" }),
  });
  assert.equal(create.status, 201);
  const { member } = (await create.json()) as { member: { id: number } };

  const crossEdit = await fetch(`${BASE}/api/owner/club/members/${member.id}`, {
    method: "PATCH",
    headers: { Cookie: clubA!.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Hijacked", memberRole: "player" }),
  });
  assert.equal(crossEdit.status, 404);

  const crossDelete = await fetch(`${BASE}/api/owner/club/members/${member.id}`, {
    method: "DELETE",
    headers: { Cookie: clubA!.cookie },
  });
  assert.equal(crossDelete.status, 404);

  // Still there, untouched, from clubB's own point of view.
  const stillThere = await fetch(`${BASE}/api/owner/club`, {
    headers: { Cookie: clubB!.cookie },
  });
  const body = (await stillThere.json()) as { members: { id: number; full_name: string }[] };
  assert.ok(body.members.some((m) => m.id === member.id && m.full_name === "Club B Athlete"));

  // Clean up via the rightful owner.
  await fetch(`${BASE}/api/owner/club/members/${member.id}`, {
    method: "DELETE",
    headers: { Cookie: clubB!.cookie },
  });
});

test("logging out ends the owner session", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  // Log in fresh so the earlier tests' cookie for clubA is unaffected.
  const login = await fetch(`${BASE}/api/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: clubA!.email, password: clubA!.password }),
  });
  const cookie = extractCookie(login, "ngwh_owner_session")!;

  const before = await fetch(`${BASE}/api/owner/me`, { headers: { Cookie: cookie } });
  assert.equal(before.status, 200);

  await fetch(`${BASE}/api/owner/logout`, { method: "POST", headers: { Cookie: cookie } });

  const after = await fetch(`${BASE}/api/owner/me`, { headers: { Cookie: cookie } });
  assert.equal(after.status, 401);
});

test("unassigning a club's owner deactivates the account immediately, mid-session", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  // A fresh session for clubB, independent of the CRUD test above.
  const login = await fetch(`${BASE}/api/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: clubB!.email, password: clubB!.password }),
  });
  const cookie = extractCookie(login, "ngwh_owner_session")!;
  assert.equal((await fetch(`${BASE}/api/owner/me`, { headers: { Cookie: cookie } })).status, 200);

  const unassign = await fetch(`${BASE}/api/admin/clubs/${clubB!.clubId}/owner`, {
    method: "DELETE",
    headers: { Cookie: adminCookie! },
  });
  assert.equal(unassign.status, 200);

  // The still-held cookie from before the unassignment must stop working —
  // deactivation, not just unlinking, is what makes this immediate.
  const after = await fetch(`${BASE}/api/owner/me`, { headers: { Cookie: cookie } });
  assert.equal(after.status, 401);
});

test("a subadmin cannot assign or unassign a club owner", async (t) => {
  if (!ready()) return t.skip("fixtures unavailable");
  const subLogin = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.TEST_SUBADMIN_USER ?? "read-only",
      password: process.env.TEST_SUBADMIN_PASSWORD ?? "test-pass-subadmin-2026",
    }),
  });
  const subCookie = extractCookie(subLogin, "ngwh_admin_session");
  if (!subCookie) return t.skip("subadmin fixture unavailable");

  const attempt = await fetch(`${BASE}/api/admin/clubs/${clubA!.clubId}/owner`, {
    method: "POST",
    headers: { Cookie: subCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "should-not-exist@example.com", password: "irrelevant-long-pass" }),
  });
  assert.equal(attempt.status, 403);
});
