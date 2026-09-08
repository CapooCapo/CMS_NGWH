# Implementation Progress — Club & Admin Workflow

**Date**: 2026-09-03. **Repo**: `/home/giahoang/dev/ngwh` (`web/` + `studio/`, each its own
git repo, root not a repo — matches `CLAUDE.md`). This is the repository that actually
matches the project's own `CLAUDE.md`; see "Note on the task's stated repo path" below.

## Note on the task's stated repo path

The task named `/home/giahoang/dev/basketball-web/root-NGWH` as the repository. That
directory exists but is an **unrelated, differently-structured project**: package name
`frontend`, Jest instead of `node --test`, a flat `src/` with `AGENTS.md`/`assets`/`media`
at top level, and its own `.ai/PROJECT_WORKFLOW.md` — which explicitly documents itself as
describing *that* codebase and says "It does **not** describe the sibling
`/home/giahoang/dev/ngwh` project... Nothing named in this document exists in `ngwh`."
All work below was done in `/home/giahoang/dev/ngwh`, the repo that matches this session's
actual `CLAUDE.md` (Next.js 16 + Tailwind v4 + Sanity + Postgres + `node --test`).

## Read before implementing (per the task's own §26)

`.ai/REQUIREMENTS.md` and `.ai/ARCHITECTURE.md` §13 mark the **club-organization
self-service dashboard as explicitly BLOCKED**, not merely unbuilt:

- `REQ-REG-004` (Club Dashboard, authenticated access) — **BLOCKED** by `OQ-012`
  (authentication method for club accounts — Open).
- `REQ-REG-005` (self-service roster/personnel updates) — **BLOCKED** by `OQ-013`
  (update deadline — Open) and depends on REQ-REG-004.
- `REQ-CLUB-003` (who approves a registration) — **PARTIALLY_READY**, `OQ-010`
  (approver role) — Open.
- The codebase already documents this as a deliberate decision, not a gap: migration
  `002_auth_uploads_stats_contact.sql` states "No public sign-up path exists," and
  `registrationReview.ts` / the registration API route carry inline comments citing
  OQ-010/OQ-012 by ID.
- `.ai/ARCHITECTURE.md` §13: `accounts real implementation` → depends on OQ-012,
  "Boundary defined, implementation deferred"; `RBAC role set` → depends on OQ-010,
  "Candidate shape only."

Per the task's instruction ("If the project explicitly says do not answer this question,
do not answer it through code... mark it BLOCKED"), **this pass does not implement a
club-owner account system, club-owner login, or a `/my-club` self-service dashboard.**
Building one would mean silently deciding an authentication method and a role model the
requirements explicitly leave open. Instead, this pass completes the workflow that *is*
READY: **staff (admin/subadmin) manage the full club profile** — info, achievements,
roster, coaching staff, contact and social links — through the existing admin RBAC, and
the public club page renders that data completely, including empty states.

## What was actually implemented this pass

The prior state (verified by reading the code, not assumed from docs) already had a
mature admin system: staff auth/sessions, RBAC (superadmin/admin/editor/operator/
subadmin), full subadmin create/disable/role-change UI, public club registration →
admin review → auto-published club, and a public club profile page reading real Sanity
+ Postgres data. What was genuinely missing was **UI for backend capability that already
existed, plus two backend gaps**:

1. **Club edit UI** — `PATCH /api/admin/clubs/[id]` existed; no admin page exposed it.
   Added an "Edit club" form (name, slug, province, founding year, logo, contact,
   website, achievements EN/VI, social links, publish toggle) to
   `src/app/admin/(protected)/clubs/page.tsx`.
2. **Roster/coaching-staff table with edit/delete** — the admin page only had an
   "Add member" form and never listed existing members. Added `ClubMembersTable.tsx`:
   a real `<table>` (not cards) with Edit (inline form) and Delete (confirm) per row.
3. **Member edit was missing server-side** — only create/delete existed
   (`club_members` has no `UPDATE`). Added `updateClubMember()` to the repository, a
   `PATCH` handler on `.../members/[memberId]/route.ts`, reusing the existing
   `parseClubMember` validator and `requireRole("editor")` guard.
4. **Social links had no UI** — the `social_links` JSONB column existed and was
   already validated/rendered publicly, but no form could write it. Extended the
   shared `JsonForm` component with a `urlgroup` field type (a labelled set of URL
   inputs packed into one nested object), used for Facebook/Instagram/YouTube/TikTok
   on both the create and edit club forms.
5. **Public club page empty states** — achievements and contact/social sections
   previously vanished entirely when empty. Now each section always renders, with the
   exact Vietnamese/English empty-state copy the task specified ("Chưa có thành tích
   nào được ghi nhận.", "Chưa có thông tin liên hệ.", "Chưa có liên kết mạng xã hội."),
   plus a labeling bug fix (the phone `<dt>` was reusing the "Contact" label instead of
   "Phone"/"Điện thoại").
6. **Dead deep link fixed** — the registrations page already linked to
   `/admin/clubs?highlight=<id>`; the clubs page ignored the parameter. Now it scrolls
   to and highlights that club.

### Deliberately not touched

- Club-owner authentication/`/my-club` dashboard — BLOCKED, see above.
- Public exposure of club documents — the only document storage
  (`registration_documents`) is tied to the *registration*, not the approved club, is
  admin-only, and no requirement authorizes making it public. Making it public would be
  inventing scope and a genuine privacy risk (task §17 explicitly warns against this).
  Admin can already view a club's originating registration's documents from the
  Registrations screen.
- Admin nav — left unchanged. It already lists exactly Registrations/Clubs/Seasons/
  Matches/Contact/Staff accounts; News/Gallery/Site Settings are Sanity Studio's
  responsibility per `CLAUDE.md`'s two-data-store architecture, not this admin.

## Workflow-by-workflow status

| Workflow | Status | Notes |
|---|---|---|
| Admin login / logout / session | **IMPLEMENTED** | Pre-existing; `/admin/login`, `AdminShell` shows username+role, `LogoutButton`. Verified live. |
| Admin dashboard & nav | **IMPLEMENTED** | Pre-existing; role-filtered nav in `AdminNav.tsx`. |
| Admin creates/disables Subadmin | **IMPLEMENTED** | Pre-existing, fully wired UI (`/admin/users`): create with role selector, enable/disable, role change, last-superadmin protection. Verified live end-to-end this pass. |
| Public club registration → pending → admin review → approved club | **IMPLEMENTED** | Pre-existing (`registrationReview.ts` auto-creates the `clubs` row on approval, in one transaction). |
| Admin/subadmin directly creates a club | **IMPLEMENTED** | Pre-existing create form; verified live. |
| Admin edits club info (incl. achievements, contact, social) | **IMPLEMENTED (this pass)** | New "Edit club" form + `urlgroup` social-links UI. Verified live via HTTP. |
| Roster / athlete management (table, create/edit/delete) | **IMPLEMENTED (this pass)** | New `ClubMembersTable`; new `updateClubMember` repo fn + `PATCH` route (create/delete already existed). Verified live. |
| Coaching staff management | **IMPLEMENTED (this pass)** | Same `club_members` table/UI, `member_role = 'coach'`/`'staff'` — reused, not duplicated. |
| Public club profile (overview/achievements/roster/staff/contact/social) | **IMPLEMENTED (this pass for empty states; rest pre-existing)** | Real DB data, bilingual, all sections always render with empty states. Verified live in both locales. |
| Club documents ("Hồ sơ năng lực") — admin view | **IMPLEMENTED** | Pre-existing, admin-only, authenticated download route, tied to the registration. |
| Club documents — public exposure | **NOT IMPLEMENTED — no requirement authorizes it; left admin-only by design.** | See "Deliberately not touched." |
| Club Owner authenticated login | **BLOCKED** | `OQ-012` (auth method) Open. |
| `/my-club` self-service dashboard | **BLOCKED** | `OQ-012`, `OQ-013` Open; depends on REQ-REG-004. |
| Club-owner-vs-club-owner isolation ("cannot edit another club") | **BLOCKED** | No club-owner account model exists to isolate (see above). Staff-side isolation (subadmin read-only, wrong role → 403) is implemented and tested. |

## Authorization rules (verified, not merely coded)

- Every club/member mutation route re-runs `requireRole("editor")` (or `requireRole()`
  for club publish/edit) server-side — session-derived, never trusts the request body.
- `subadmin` (read-only) gets 200 on every business `GET`, 403 on every `POST`/`PATCH`/
  `DELETE`, including the two new endpoints — added to the automated authorization
  matrix and confirmed live.
- Unauthenticated → 401 on every admin endpoint, including the new `PATCH
  .../members/[memberId]` — added to `tests/api-authorization.test.ts`'s endpoint
  sweep and confirmed live.
- `PATCH`/`DELETE` on a member are scoped by `club_id` in the same query (`WHERE id =
  $1 AND club_id = $2`), so a member cannot be edited/deleted through the wrong club id
  — covered by a new DB-backed test.

## Tests

- **New**: `web/tests/clubs.test.ts` (DB-backed, fixture-tagged, self-cleaning) —
  `updateClub` persists achievements/contact/social and returns `null` for a
  nonexistent id; full member create→edit→delete round trip; cross-club scoping
  (editing/deleting through the wrong club id is a no-op); roster-then-staff ordering.
- **Extended**: `tests/api-authorization.test.ts` — added `PATCH
  /api/admin/clubs/1/members/1` to the 401-unauthenticated sweep.
- **Extended**: `tests/superadmin-authorization.test.ts` — added club `PATCH`, member
  `POST`/`PATCH`/`DELETE` to the "subadmin cannot mutate business content" case (403
  each).
- **Result**: `npm test` — 86 tests, 85 pass, 1 skipped (the live-server suite's
  no-`TEST_ADMIN_PASSWORD` case; the two DB-backed/live-server suites that *do* have
  credentials all ran, not skipped, since Postgres and a dev server were both reachable).
- `npx tsc --noEmit` — clean. `npm run lint` — clean. `npm run build` — succeeds
  (Turbopack production build, all routes compile).

## Manual E2E verification (real HTTP against the running dev server + real Postgres)

No browser-automation tool was available in this session, so verification was done as
full HTTP request/response cycles against the actual running `next dev` server and the
actual Postgres database — exercising session cookies, every guard, and real
persistence, short of visual/rendering inspection. Steps executed and observed:

1. Login as fixture superadmin (`root-super`) — 200, session cookie set. ✅
2. `GET /api/admin/me` — reports `superadmin`. ✅
3. Superadmin creates a subadmin (`e2e-subadmin-check`) — 201, appears in `GET
   /api/admin/users`. ✅
4. Login as the new subadmin — 200. Read `/api/admin/clubs` — 200. Attempt
   `POST /api/admin/clubs` — **403**. ✅
5. Login as fixture admin (`biz-admin`) — 200.
6. Admin creates a club, published — 201.
7. Admin edits it via the new `PATCH` path: achievements (EN+VI), phone, website,
   Facebook link — 200, all fields persisted and returned.
8. Admin adds an athlete and a coach via `POST .../members` — 201 each; `GET` the club
   shows both, in the same request the new admin page uses.
9. Subadmin attempts to `PATCH` the athlete — **403**.
10. Admin edits the athlete via the new `PATCH .../members/[memberId]` — 200, fields
    updated.
11. Admin deletes the coach — 200; roster now shows only the edited athlete.
12. Public club page (`/clubs/e2e-hoops-club`) — 200, HTML contains the real
    achievements text, the edited athlete's name, the phone number, and the Facebook
    link, in both `en` and `vi` (`NEXT_LOCALE` cookie), with `vi` showing "Liên hệ &
    Mạng xã hội" / "Thông tin liên hệ" / "Thành tích" exactly.
13. A second, empty club (`e2e-empty-club`) — public page (`vi`) renders all four
    required empty states verbatim: "Chưa có thành tích nào được ghi nhận.", "Chưa có
    thông tin liên hệ.", "Chưa có liên kết mạng xã hội.", plus the pre-existing roster
    empty state.
14. Admin clubs page HTML (`/admin/clubs`) — 200, contains the new "Edit club",
    "Roster & coaching staff", "Social links" UI.
15. The `?highlight=<id>` deep link from the registrations page — 200 (previously a
    dead parameter).
16. Unauthenticated request to `/admin/clubs` — 307 to `/admin/login?next=...`.
17. All sessions logged out; all fixture rows created during verification
    (`e2e-hoops-club`, `e2e-empty-club`, `e2e-subadmin-check`) deleted directly from
    Postgres afterward — the running dev database was left exactly as found.

**This constitutes real E2E verification of the implemented workflow**, though it was
performed via direct HTTP calls rather than a browser driver; no claim is made about
visual/CSS correctness, which was not independently checked beyond what the existing
`npm run build` and the design-system-consistent component reuse (`Table`/`Card`/
`Badge`/`JsonForm`) already imply.

## Remaining blockers (explicit, not silently decided)

- **Club Owner login and `/my-club`**: blocked on `OQ-012` (authentication method) and
  `OQ-013` (update deadline). Needs a stakeholder decision, recorded as an Open
  Question resolution in `Requirement_Analysis.xlsx`, before any account/schema work
  can start.
- **Club registration approver role**: `OQ-010` is Open; the codebase's `admin`-role
  gate on registration review is a documented placeholder, not a final answer.
- **Public exposure of club documents**: no requirement covers this; flagging as
  `NEEDS_REVIEW` rather than building it.

## Files changed

- `web/src/server/repositories/clubs.ts` — added `updateClubMember`.
- `web/src/app/api/admin/clubs/[id]/members/[memberId]/route.ts` — added `PATCH`.
- `web/src/components/admin/JsonForm.tsx` — added the `urlgroup` field type.
- `web/src/components/admin/ClubMembersTable.tsx` — new: roster/staff table with
  inline edit + delete.
- `web/src/app/admin/(protected)/clubs/page.tsx` — edit-club form, roster table,
  social links, `?highlight=` fix.
- `web/src/components/ui/index.tsx` — added `colSpan` to the shared `Td`.
- `web/src/app/(site)/clubs/[slug]/page.tsx` — empty states for achievements/contact/
  social; fixed the phone `<dt>` label bug; restructured the contact/social section.
- `web/messages/en.json`, `web/messages/vi.json` — new `clubs.*` i18n keys
  (`noAchievements`, `contactSocial`, `contactInfo`, `phone`, `noContact`, `noSocial`),
  parity verified.
- `web/tests/clubs.test.ts` — new DB-backed regression suite.
- `web/tests/api-authorization.test.ts`, `web/tests/superadmin-authorization.test.ts` —
  extended to cover the new endpoints.

Nothing was committed (per instructions); nothing outside this scope was refactored or
redesigned.

---

# Session 2 — Reference-Driven Audit (`root-NGWH` as workflow reference)

**Date**: 2026-09-03, continuation. This session correctly treats
`/home/giahoang/dev/basketball-web/root-NGWH` as a **reference implementation** to mine
for business workflows — not as the target app (Session 1 above found the task's stated
repo path was wrong; this session's framing is consistent with that finding). Its own
`.ai/` is empty (default `create-next-app` boilerplate `README.md`/`CLAUDE.md`, no
planning docs) — everything below comes from reading its source directly, not from docs.

## Phase 1 — Workflow audit (`root-NGWH` → `web`)

| Workflow (root-NGWH) | root-NGWH implementation | `web` equivalent | Status | Action taken |
|---|---|---|---|---|
| Admin auth | HMAC-signed cookie (`adminAuth.ts`), env-var bootstrap credentials | DB-backed opaque sessions, scrypt, `scripts/create-admin.mjs` | **COMPLETE (superior)** | None — `web`'s design is already the more secure, already-migrated version of this. |
| Admin/Subadmin RBAC | 2 roles (`admin`, `subadmin`), subadmin read-only | 5 roles (`superadmin/admin/editor/operator/subadmin`), same read-only subadmin concept plus finer capability split | **COMPLETE (superset)** | None. |
| Generic user account system (`/register`, `/login`, `/forgot-password`, `/reset-password`, `/account`) | Full self-service email+password signup (`users` table, `role: club_user\|admin`), JWT-ish token, no email verification | **None** — deliberately | **BLOCKED BY REQUIREMENT** | Not built. `.ai/REQUIREMENTS.md`: "'Login,' 'Register'... and 'Forgot Password' are not requirements... zero requirement... for a generic end-user account system or password reset anywhere... treat as new scope requiring a new requirement and Open Questions — do not invent them." Confirmed, not overridden. |
| Club-owner dashboard (`/dashboard`, `/account/clubs/[id]/edit`) | `clubs_club.user_id` FK; owner-only edit gated by `club.user_id === session.user.id` | **None** — deliberately | **BLOCKED BY REQUIREMENT** | `OQ-012` (auth method) / `OQ-013` (update deadline) Open; depends on the account system above, itself blocked. |
| Public club registration → admin review → approved club | `clubs_club` + admin approve route, `is_approved` | `club_registrations` → `registrationReview.ts` (one transaction, auto-creates + publishes the `clubs` row) | **COMPLETE** | None — `web`'s version is equivalent, already transactional. |
| Club profile fields | `name, province_region, representative_name, logo, founding_year, achievements (plain text), contact_info (opaque JSON blob), social_links, capability_profile (file), u20_athlete_list (file)` | `name, province, founding_year, logo_url, achievements_en/vi (bilingual — better), contact_email/phone, website_url (structured — better), social_links` | **COMPLETE (mostly superior)** | No field changes — `web`'s bilingual/structured columns are a strict improvement; inventing extra fields (e.g. `representative_name` on the club row itself) isn't justified by any `REQ-CLUB-*`. |
| Roster (players) | `name, jersey_number, position, date_of_birth` | `full_name, member_role, shirt_number, position, birth_year` | **COMPLETE** | `birth_year` vs full `date_of_birth`: `.ai/ARCHITECTURE.md` explicitly leaves roster fields "pending LLD" beyond "a roster exists" — not a gap, a valid existing choice. Not changed (would be scope creep, not a missing workflow). |
| Coaching staff | Separate `coach_staff` table: `name, role, description` | Same `club_members` table as roster, `member_role IN ('coach','staff')` | **COMPLETE (better — no duplicate table)** | None. `web` already reuses one model for both, which is what this task's own §7 principle ("reuse an existing model if it represents the same concept") argues for. |
| Roster/staff **management UI** (add/edit/delete, real table) | Full CRUD forms under `/account/clubs/[id]/edit`, owner-only | **Built in Session 1** (`ClubMembersTable.tsx`, admin/editor-only, since the owner surface is blocked) | **COMPLETE** (as admin/editor, not owner, workflow) | Session 1. |
| Club documents — private, admin-only view | N/A (root-NGWH stores files under `/media`, admin `clubMediaRepository`) | `registration_documents`, admin-only authenticated download | **COMPLETE** | Pre-existing. |
| Club documents — **public exposure on the club profile** (`capability_profile`, `u20_athlete_list`, shown under "Documents" with a direct link) | **Yes** — public club page renders `capability_profile`/`u20_athlete_list` links unconditionally once the club is approved | Was previously **admin-only**, nothing public | **Built this session** | See "What was newly implemented" below. |
| News / Gallery / About / Homepage / Site settings / Hero | Full Postgres+Jest CRUD admin (`admin/news`, `admin/gallery`, `admin/homepage`, `admin/site-settings`, `admin/hero`) | Sanity Studio (separate app): `newsArticle`, `galleryItem`, `homePage`/`aboutPage`/`contactPage` singletons, category label maps (incl. MVP Spotlight / Behind-the-Scenes / Hall-of-Fame-style categories per `REQ-GALLERY-002/003`), hero as a video carousel (`OQ-003` closed) | **COMPLETE (different, correct store)** | **Not rebuilt** — this task's own §17/§2 explicitly forbid duplicating a working Sanity-backed feature with a second Postgres+admin implementation. `web`'s two-store split (`CLAUDE.md`) is deliberate architecture, not a gap. |
| Match / Tournament / Live score | `matchesServerService`, admin match CRUD, `(public)/obs` browser-source overlay | `matches` repo/service, `ScoreConsole.tsx`, `/api/live` (polled, `no-store`), `/live` (`force-dynamic`), standings + top-scorer/assist leaders | **COMPLETE**, except OBS overlay | OBS overlay: **NOT_APPLICABLE** — no `REQ-*`/`OQ-*` in `.ai/REQUIREMENTS.md` mentions broadcast-overlay integration at all (not even as an Open Question); building it would be inventing net-new scope this task's §23 forbids ("do not implement features... out of scope"). |
| Contact submissions | `contact_submissions`, admin inbox | `contact_messages`, admin inbox (`/admin/contact`) | **COMPLETE** | None. |

## What was newly implemented this session

Only one genuinely missing, non-blocked workflow surfaced: **publishing a club's
capability-profile document on its public profile**, which `root-NGWH`'s reference
implementation treats as a normal, unconditional part of an approved club's public page.
`web`'s upload architecture (generic multi-file `registration_documents`, admin-only)
had no concept of "public" at all. Implemented as a minimal, additive, opt-in extension:

- **Migration `004_public_club_documents.sql`** — adds `registration_documents.is_public`
  (`BOOLEAN NOT NULL DEFAULT FALSE`). Nothing becomes public by this migration alone.
- **Repository** (`registrations.ts`) — `setDocumentVisibility`, `listPublicClubDocuments`,
  `findPublicClubDocument` (joins `club_registrations.club_id`, so a document is only
  ever reachable through the specific club it belongs to).
- **Admin API** — `PATCH /api/admin/registrations/[id]/documents/[documentId]`
  (`{isPublic}`), gated `requireRole()` (admin/superadmin — the same gate as BR-001
  approval itself, since "make this visible to the world" is the same class of decision).
- **Admin UI** — a Public/Private badge and a Publish/Unpublish `ToggleButton` per
  document on `/admin/registrations` (with a confirmation before publishing).
- **Public API** — `GET /api/clubs/[slug]/documents/[documentId]`, unauthenticated,
  reachable **only** when the club is approved *and* the document is `is_public = TRUE`;
  same anti-sniffing headers (`nosniff`, forced `attachment`) as the admin download.
- **Public club page** — a new "Club documents" / "Tài liệu câu lạc bộ" section, always
  rendered, with the document list or the empty state ("Chưa có tài liệu công khai.").
- **This is a judgment call, not a resolved requirement**: `.ai/REQUIREMENTS.md` doesn't
  say documents are public or private — `OQ-011` covers only upload validation. Flagging
  as **NEEDS_REVIEW**: a stakeholder should confirm this default-private/opt-in-public
  model is correct product behaviour, though it's evidenced by the reference
  implementation's actual (unconditional) behaviour and is deliberately more conservative
  (default private, explicit per-document opt-in, only ever the specific document a
  reviewer chose — not "publish everything the applicant uploaded").

## Tests (session 2 additions)

- `tests/public-club-documents.test.ts` (new, DB-backed): defaults to private;
  publishing makes a document reachable only through its own club (not a different
  club's id); unpublishing removes it again; visibility scoped by registration id.
- `tests/api-authorization.test.ts`: added `PATCH .../documents/[documentId]` to the
  401 sweep; added a case confirming the public document route needs no session but
  404s for a nonexistent club/document (never leaks existence).
- `tests/superadmin-authorization.test.ts`: added the visibility `PATCH` to the
  subadmin-403 matrix.
- **Result**: `npm test` — 91 tests, 90 pass, 1 skip (same pre-existing skip as
  Session 1). `tsc --noEmit`, `lint`, `build` all clean.

## Manual E2E (session 2, live dev server + real Postgres)

1. Public `POST /api/registrations` with an uploaded PDF — 201.
2. Admin approves it — 200, auto-creates and publishes the club (as in Session 1).
3. Admin registrations page HTML shows the document with a "Private" badge and a
   "Publish to club page" button.
4. Public club page, pre-publish — "Club documents" section renders with the empty
   state ("No public documents yet.").
5. `GET /api/clubs/<slug>/documents/<id>` while private — **404**, no session.
6. Subadmin attempts `PATCH .../documents/<id>` — **403**.
7. Admin `PATCH .../documents/<id>` `{isPublic:true}` — 200.
8. `GET /api/clubs/<slug>/documents/<id>` — now **200**, no session, correct
   `Content-Type`, forced `attachment` disposition, `nosniff`.
9. Public club page (`vi` locale) now renders the filename, "Xem tài liệu" link, and
   "Tài liệu câu lạc bộ" heading — exact wording match.
10. All sessions logged out; the fixture registration/club deleted directly from
    Postgres afterward — dev database left as found.

## Blocked (reaffirmed, with the reference implementation as further evidence)

- **Generic account system / Club Owner login / `/my-club` self-service** — `OQ-012`,
  `OQ-013` Open in `.ai/REQUIREMENTS.md`. Seeing `root-NGWH`'s actual implementation
  (open self-registration, no email verification, HMAC token) does not answer these
  Open Questions for `web` — it confirms what shape the decision would take, which is
  exactly the kind of decision `.ai/REQUIREMENTS.md` says not to invent through code.
- **OBS browser-source overlay** — not mentioned anywhere in `.ai/REQUIREMENTS.md` or
  `.ai/ARCHITECTURE.md`, not even as an Open Question. Out of scope per this task's §23.

## Files changed (session 2)

- `web/src/server/migrations/004_public_club_documents.sql` — new.
- `web/src/server/repositories/registrations.ts` — added `setDocumentVisibility`,
  `listPublicClubDocuments`, `findPublicClubDocument`; `is_public` added to
  `RegistrationDocumentMeta`.
- `web/src/app/api/admin/registrations/[id]/documents/[documentId]/route.ts` — added
  `PATCH`.
- `web/src/app/api/clubs/[slug]/documents/[documentId]/route.ts` — new public route.
- `web/src/app/admin/(protected)/registrations/page.tsx` — publish/unpublish toggle
  per document.
- `web/src/app/(site)/clubs/[slug]/page.tsx` — new "Club documents" section.
- `web/messages/en.json`, `web/messages/vi.json` — `clubs.documents`,
  `clubs.viewDocument`, `clubs.noDocuments` (parity verified).
- `web/tests/public-club-documents.test.ts` — new.
- `web/tests/api-authorization.test.ts`, `web/tests/superadmin-authorization.test.ts` —
  extended.

Nothing was committed. No unrelated files were touched.
