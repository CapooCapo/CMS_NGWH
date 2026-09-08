# Implementation Status

## Purpose

Current execution state only — what's done, in progress, blocked, and
what's next. Not a requirement audit (`REQUIREMENTS.md`) and not the
Sprint plan (`SPRINT_PLAN.md`) — just "where are we right now."

## Current state

**Backend Migration (Django -> Full-Stack Next.js) is COMPLETE.**
- The DRF backend service has been fully migrated into Next.js App Router API Route Handlers under `/src/app/api/` backed directly by PostgreSQL.
- Database access layer implemented in `/src/server/db/` and repositories in `/src/server/repositories/` using direct SQL queries (`pg`).
- Domain logic, business rules (e.g. approval workflow filtering `is_approved = true`), validation error formats, and API response structures are 100% logic-identical to the original Django implementation.
- Django backend service container decommissioned from `docker-compose.yml`; Next.js frontend container connects directly to PostgreSQL database.
- 185 Next.js Jest unit tests pass with zero lint or typecheck errors.

**Admin System Implementation is COMPLETE.**
- Full Low-Level Design document created in `.ai/lld/admin.md`.
- Secure server-side authentication (`/api/admin/login`, `/api/admin/logout`, `/api/admin/me`, `adminAuth.ts`) with HMAC SHA-256 session tokens stored in httpOnly cookies.
- Admin UI shell and layout (`/admin`, `/admin/login`) with responsive desktop sidebar and mobile drawer navigation.
- Real-time DB Dashboard metrics (`/admin/dashboard`).
- Club Management & Approval workflow (`/admin/clubs`).
- Club Registration Submissions & Uploaded Documents viewer (`/admin/registrations`).
- Player Roster Management (`/admin/players`).
- Seasons & Matches Management (`/admin/seasons`, `/admin/matches`).
- Content Management for News, Gallery, and Contact (`/admin/news`, `/admin/gallery`, `/admin/contact`).
- Content-driven Homepage Hero Management (`/admin/homepage/hero`) backed by dynamic PostgreSQL `hero_slides` table and public `heroServerService.ts` integration.
- 100% test coverage verified (58 test suites / 185 tests passing, `tsc --noEmit` 0 errors, ESLint 0 errors, `npm run build` succeeds).

**Production Superadmin Bootstrap Mechanism is COMPLETE.**
- Safe server-side one-time bootstrap mechanism added to `schemaInit.ts` (`bootstrapAdminUser()`), triggered automatically during initial PostgreSQL database schema initialization.
- Reads `ADMIN_BOOTSTRAP` and `ADMIN_BOOTSTRAP_PASSWORD` environment variables without logging or exposing values.
- Hashes password using native PBKDF2 SHA-512 with static salt `ngwh_admin_rbac_salt_2026` matching `adminUsersRepository.ts`.
- Checks for duplicate account existence (`LOWER(username) = LOWER($1)`) before inserting, logging safe non-sensitive skipped/completed messages.
- Full documentation authored in `.ai/ADMIN_BOOTSTRAP.md`.
- 100% test coverage verified (65 test suites / 237 tests passing, `tsc --noEmit` 0 errors).

**Hero Section Lock to Static Architecture is COMPLETE.**
- Converted public Hero Section rendering to source-controlled static assets (`public/assets/hero/` & `src/config/heroSlides.ts`), fully decoupled from PostgreSQL database queries.
- Admin UI for Hero management (`/admin/homepage/hero`) removed from navigation and replaced with a read-only informational status card.
- Admin Hero mutation APIs (`POST /api/admin/hero`, `PATCH /api/admin/hero/[id]`, `DELETE /api/admin/hero/[id]`, `POST /api/admin/hero/reorder`) updated to return `405 Method Not Allowed`.
- Hero upload storage service `heroMediaService.ts` removed. Shared media serving (`/media/[...path]`) and Club media handling (`clubsServerService.ts`) remain 100% operational and untouched.
- Legacy `hero_slides` PostgreSQL table preserved without data loss.
- Hero section no longer requires Render Persistent Disk or Object Storage; hero asset changes are managed directly through source control and standard deployments.


**Sprint 0 (Foundation) is COMPLETE.** All 5 scope items done and
verified. First application code exists at `frontend/`. Docker
infrastructure for local development now exists (`frontend`-only; see
below) and has been re-verified end-to-end (config, build, startup,
networking, volumes, i18n, TypeScript, ESLint, Jest). One new, unrelated
issue surfaced during that re-verification: the production `next build`
currently fails on an apparent upstream Next.js bug — see **Blocked**
and the Docker entry under **Completed** below. It does not affect
Sprint 0's dev-mode Definition of Done, which remains met.

**Sprint 1 (Confirmed Public Content) is COMPLETE for its scoped
requirements.** A holistic final acceptance review (fresh `tsc`/`eslint`/
`jest`/production build, full 8-route × 2-locale regression sweep, a
News-detail-route + 404 check, and a design-system/component-reuse audit
across all four pages together) confirmed: Home, News, About Us, and
Gallery each pass every applicable check in `SPRINT_PLAN.md`'s Sprint 1
scope, with no regression and no confirmed defect. **REQ-GALLERY-001's
video half remains explicitly unresolved and unimplemented** — no Open
Question tracks it, and per `SPRINT_PLAN.md` it was never part of Sprint
1's numbered scope (the photo slice was the only Sprint-1 deliverable);
it sits in the Post-Clarification Backlog pending a proposed new Open
Question. This is the one confirmed gap in an otherwise complete Sprint,
recorded here rather than glossed over (`RULES.md` R009/R015). All 15
Open Questions (`OQ-001`–`OQ-015`) remain open and unresolved — none were
touched by this review.

**Sprint 2 (Club Data Model & Public Directory/Profile) — Batch 1 (Club
domain data model) is COMPLETE.** This is the first Django/PostgreSQL
backend code in the project — `backend`/`postgres` are now provisioned in
`docker-compose.yml`, per `ARCHITECTURE.md` §9's explicit trigger.

**Batch 2 (RBAC foundation) is COMPLETE — with an important scope
finding.** Rigorously deriving the permission matrix from confirmed
requirements (as instructed) shows that **3 of the 4 candidate roles
(System Admin, Club Manager, Content Editor) have zero confirmed
permission in this batch** — `ARCHITECTURE.md` §7 already said as much
("candidate shape only... the real role set comes from `OQ-010`"), and
this batch's analysis confirms it holds for every role, not just the
approver. Only **Guest** (public, read-only, approved-clubs-only) has a
confirmed permission. No Django Group was created for the other three —
doing so with zero permissions to attach would be inert scaffolding that
risks reading later as "these are the final role names," which
`RULES.md` R022 specifically warns against. See **Completed** below for
the full matrix and what was actually built.

**Batch 3 (Public Club Directory) is COMPLETE.** First DRF endpoint
(`GET /api/clubs/`, built on Batch 2's `Club.objects.approved()`
boundary) and first real frontend-to-backend network integration in the
project (every Sprint 1 service is fixture-backed). `OQ-009` ("map view,
list view, or both?") was checked, not resolved — only the list-view
slice was built; the map slice is `BLOCKED` and nothing was reserved for
it (no library, no geo field, no toggle). See **Completed** below.

**Batch 4 (Public Club Profile) is COMPLETE — Sprint 2 is now complete
for every non-OQ-gated slice of REQ-CLUB-001–006.** `GET
/api/clubs/{id}/` (`ClubDetailView`/`ClubDetailSerializer`, same
`Club.objects.approved()` boundary) and the `/clubs/[clubId]` page —
REQ-CLUB-003's display gate in full, REQ-CLUB-004/005/006 in full.
`OQ-009` (map) and `OQ-010` (approval action) remain the only excluded
slices, unchanged from Batches 1–3. **Implementation surfaced a genuine
Next.js constraint, not a business-logic gap**: a `loading.tsx` anywhere
in the `/clubs` ancestor chain permanently locks the HTTP response
status at 200 once Suspense streaming begins — incompatible with
`notFound()`'s required 404 for an unapproved/nonexistent club (BR-001).
Confirmed empirically against a live dev server (with either this
route's own or the Directory's `loading.tsx` present, `/clubs/{id}` for
an unapproved club returned `200`; with both removed, `404`). Resolution:
no `loading.tsx` was shipped for `/clubs/[clubId]`, and the pre-existing
`/clubs/loading.tsx` (Batch 3) was **removed** — both routes now render
without a skeleton, like every Sprint 1 page. See **Completed** below and
`.ai/lld/club-profile.md` §8/§21 / `.ai/lld/club-directory.md` §10 for
the full account.

**Sprint 3 (Club Registration) is COMPLETE for its scoped requirements
— REQ-REG-001/002/003.** `POST /api/clubs/` (same URL/name the
Directory's `GET` already used) now accepts a public registration
submission and creates a new, unapproved `Club` — `Club.representative_name`/
`capability_profile`/`u20_athlete_list` added additively (one migration,
zero drift confirmed via `makemigrations --check`), never exposed
through the existing Directory/Profile serializers, never overridable
via a client-supplied `is_approved`. Frontend: `Input`/`Label`/`FormField`
(new `components/ui` primitives), `RegistrationForm`/`FileUploadField`
(`components/features/registration`), a `"use server"` Server Action
(`club-registration/actions.ts`, following the exact `setLocaleAction`
precedent), and `clubsService.registerClub`. `REQ-REG-004`/`005` (Club
Dashboard, authenticated roster updates) remain untouched in the
Backlog — `OQ-012`/`OQ-013` unaffected. `OQ-011` (upload format/size
validation) remains open — the upload *mechanism* (UUID-based storage
paths, a new `backend_media` Docker volume, dev-mode media serving) is
built in full, but no file-type/size restriction was added anywhere.
See **Completed** below for the full account.

**Sprint 4 (Tournament Structure) is COMPLETE for its scoped
requirements — REQ-TOURN-001/004.** `.ai/lld/tournaments.md` authored
and reviewed before implementation, marked `TOURNAMENTS_LLD_READY`.
Two new Django apps — `tournaments` (`Tournament`/`Season` models,
`GET /api/seasons/`) and `matches` (`Match` model, `GET /api/matches/`)
— both additive-only migrations, zero drift confirmed. Frontend:
`ScheduleTable`/`ArchivesList` (`components/features/tournaments`, the
exact names `ARCHITECTURE.md` §4 reserves), `tournamentsService.ts`,
`types/tournament.ts`; `app/tournaments/page.tsx` replaces the Sprint-0
`PagePlaceholder`. `REQ-TOURN-002`/`003` (standings/stats) remain
untouched in the Backlog — `OQ-005`/`OQ-007`/`OQ-008` unaffected, no
score/result field added, no shell built for either. See **Completed**
below for the full account.

**Post-Sprint-4 — Hero video carousel (`REQ-HOME-001`'s video slice) is
COMPLETE at the mechanics level; genuinely blocked only on real video
files.** `OQ-003` gated this slice at implementation time; direct
stakeholder confirmation of "video" was given during this batch and
formally closed in the workbook afterward (`CHANGE_LOG` v1.1,
2026-08-18 — see the Sprint 5 entry below). `HeroCarousel` (new Client
Component) + data-driven `heroSlides.ts` config replace the single
static image, with full autoplay/muted/loop/playsInline, per-slide
error-fallback to the existing hero photo, `prefers-reduced-motion`
support, and translated accessible controls. No video asset exists
anywhere in the repo and none could be downloaded or fabricated in this
environment — every slide currently renders its fallback poster, which
is real, working, tested behavior, not a placeholder. See **Completed**
below for the full account.

**Sprint 5 (Integration/QA/Accessibility/Responsive/UAT) — full
regression + re-verification pass complete; no new requirement scope.**
Before the QA pass, fixed a real Header layout regression: switching
EN→VI could push/break `SiteHeader`'s layout. Root cause and fix
recorded in **Completed** below. Every Sprint 1-4 Acceptance Criterion
was re-verified live against the current codebase (not assumed from
memory); all 15 Open Questions re-checked directly against
`REQUIREMENTS.md` and confirmed still `Open` — none silently resolved.
See **Completed** below for the full account.

**Sprint 6 (Contact Info display) is COMPLETE — `REQ-CONTACT-001`.**
Selected by systematically cross-checking every `READY`/`PARTIALLY_READY`
requirement against actual implementation state (not inferred from
text): this was the one genuine gap remaining, in Sprint 1's original
scope table but never built. Real display structure shipped, backed by
a `null` fixture since no actual office/hotline/email value is confirmed
anywhere (`RULES.md` R006 — not invented). `REQ-CONTACT-002` (feedback
form) remains untouched, `BLOCKED` on `OQ-014`. See **Completed** below
for the full account.

## Completed

- Requirement Analysis, Development Planning, Architecture Finalization,
  and documentation consolidation phases (all pre-code planning work).
- **Sprint 0 — Project scaffolding**: Next.js 16 (App Router) + TypeScript
  + ESLint at `frontend/`, `sass` for SCSS support.
- **Sprint 0 — Design system foundation**: design tokens
  (`src/styles/_variables.scss`, `_mixins.scss`, `globals.scss`), base
  components `Button`, `Container`, `Card`, `PagePlaceholder` in
  `src/components/ui/`.
- **Design system — Miami Heat-inspired color palette** (not tied to a
  specific Sprint; a design-system update, not a requirement):
  `$color-brand-primary` → `#98002E`, `$color-brand-accent` → `#F9A01B`,
  `$color-neutral-900` (primary text / accent-button text) → `#000000`,
  matching the 4 approved hex values exactly (`$color-neutral-0` was
  already `#FFFFFF`). The neutral grayscale (700/500/300/100) and
  functional `$color-success`/`$color-error` were left unchanged — not
  part of the approved 4-color palette, and changing them would blur
  muted/functional semantic meaning the task asked to preserve. Every
  color flows through the existing SCSS token layer — no component
  hardcodes a hex value.
  - **Contrast-driven fix, not palette reinterpretation**: the default
    focus-ring color was reassigned from accent yellow to primary red
    (~8.85:1 vs white, vs. yellow's ~2.08:1 — below the 3:1 WCAG 1.4.11
    minimum). `SiteHeader`'s nav/brand links and `LanguageSwitcher`'s
    inactive option button keep an accent-yellow ring instead (an
    explicit override, `focus-ring($color-brand-accent)`), since they sit
    directly on the header's own primary-red background where a
    primary-red ring would be invisible (~1:1); yellow measures ~4.24:1
    there. `LanguageSwitcher`'s *active* option (white fill) falls back
    to the primary-red ring again, since its background is white, not
    red. The `focus-ring` mixin gained an optional color parameter
    (default unchanged) to support this — no new mixin, no new token.
  - **Verified**: `tsc --noEmit` clean; `npm run lint` — 0 errors, same 1
    pre-existing unrelated warning; `npm test` — 23 suites / 82 tests
    pass, unchanged (a pure CSS/token change, no component behavior
    touched); all 8 routes 200 in EN and VI; production build
    compiles/typechecks, fails at the identical pre-existing
    `/_global-error` digest (`556520841`) — not a regression; compiled
    CSS inspected directly — `#98002e`/`#f9a01b` present throughout,
    `#14213d`/`#fb8500`/`#171717` (old palette) completely absent,
    `body { color: #000; background: #fff }` confirmed.
  - **Not verified**: rendered-in-browser visual check — no
    Playwright/browser-automation tooling available in this project or
    session (same standing gap as every prior Sprint-1 task). Contrast
    was verified by computing WCAG relative-luminance ratios directly for
    every pairing the task called out (white/#98002E ≈ 8.85:1,
    black/#F9A01B ≈ 10.08:1, white/#000000 = 21:1, plus every focus-ring
    context above), not by a rendered screenshot.
- **Sprint 0 — Routing shell**: all 8 sitemap routes (`/`, `/about`,
  `/tournaments`, `/gallery`, `/clubs`, `/club-registration`, `/news`,
  `/contact`) render a Sprint-0 placeholder (title + planned Requirement
  IDs). `SiteHeader` (nav + language switcher) and `SiteFooter` in
  `src/components/layout/`.
- **Sprint 0 — Testing infrastructure**: Jest + React Testing Library
  (`jest.config.ts` via `next/jest`, with a `transformIgnorePatterns`
  override for next-intl/use-intl's ESM-only builds).
- **Sprint 0 — i18n foundation (VI/EN)**: `next-intl` wired **without
  URL-based locale routing** — locale is tracked via a `NEXT_LOCALE`
  cookie, read server-side in the root layout (`getLocale`/`getMessages`
  from `next-intl/server`), with a `setLocaleAction` Server Action
  (`src/i18n/actions.ts`) invoked from a client `LanguageSwitcher`
  component. No `[locale]` URL segment was introduced and no existing
  route file was moved — `ARCHITECTURE.md` doesn't require URL-based
  routing, and this was the least invasive option. Nav labels and page
  titles now come from `messages/{en,vi}.json`.
  - **Verified**: default (no cookie) → English, `<html lang="en">`;
    `NEXT_LOCALE=vi` cookie → Vietnamese, `<html lang="vi">`, e.g. Home
    title renders "Trang chủ"; an unsupported cookie value (e.g. `fr`)
    correctly falls back to English; all 8 routes still return 200.
  - **Known, accepted tradeoff**: reading a cookie in the root layout
    makes every route request-dependent — the production build now
    marks all 8 routes dynamic (`ƒ`) instead of static (`○`). This is a
    deliberate consequence of avoiding URL-based locale routing, not a
    regression.

- **Docker (infrastructure, not tied to a specific Sprint)**:
  `docker-compose.yml` (repo root) + `frontend/Dockerfile` (multi-stage:
  `deps`/`dev`/`builder`/`runner`) + `frontend/.dockerignore` +
  `frontend/.env.example`. Only the `frontend` service is defined —
  `backend`/`postgres` are deliberately not provisioned since no Django
  code exists yet (see `ARCHITECTURE.md` §9). `next.config.ts` now sets
  `output: "standalone"` for a minimal future production image.
  - **Verified (re-confirmed)**: `docker compose config` valid; image
    builds cleanly (cached and from a cleared `frontend_next_cache`
    volume); `docker compose up -d` starts a healthy container; all 8
    routes return 200 through the container; EN/VI i18n confirmed (default
    → English, `NEXT_LOCALE=vi` cookie → Vietnamese incl. `<html lang>`
    and translated `<h1>`, unsupported locale falls back to English);
    named volumes (`frontend_node_modules`, `frontend_next_cache`) and the
    `basketball-web_default` bridge network exist and are mounted/attached
    as configured; no `.env` values are required or leaked (only the
    checked-in `.env.example` template is used); no database service is
    configured — correct per `ARCHITECTURE.md` §9, not a gap. Inside the
    container: `tsc --noEmit` clean; `npm run lint` — 0 errors, 1
    pre-existing warning (`jest.config.ts` anonymous default export, not
    introduced by this check); `npm test` — 4 suites / 17 tests pass.
  - **New this check**: added `frontend/src/app/global-error.tsx` and
    `frontend/src/app/not-found.tsx` (Next.js's documented file
    conventions for the root error boundary and 404 UI). Neither existed
    before; both are infrastructure-level, framework-required files, not
    an application feature.
  - **Known issue — `npm run build` (production build) currently fails**:
    reproducible both via Turbopack (this project's default) and
    `--webpack`, and from a freshly-cleared `.next` cache, so it is not a
    stale-cache artifact. The build fails prerendering Next's internal
    `/_global-error` route with `TypeError: Cannot read properties of
    null (reading 'useContext')`, deep inside Next.js's own bundled
    layout-router code (not application code). Isolated by elimination —
    still reproduces identically with the `next-intl` plugin removed from
    `next.config.ts`, with `output: "standalone"` removed, and with the
    root layout replaced by a fully static version with no cookies/i18n
    at all — so this is not caused by this project's i18n approach, the
    standalone output setting, or any application code; it appears to be
    an upstream defect in the pinned Next.js `16.3.1` (latest published
    release; no newer patch exists as of this check). `RULES.md` R016
    fixes the approved stack (including the Next.js choice) — changing
    the pinned version to work around this is a stack change requiring
    explicit approval, not something to do unilaterally here. This does
    **not** affect the `dev` target actually wired into
    `docker-compose.yml` today (fully verified above); it only affects
    the not-yet-wired `builder`/`runner` stages, which `ARCHITECTURE.md`
    §9 already notes aren't used by any deployed environment yet. All
    diagnostic edits made while isolating this were reverted; no
    permanent config changes resulted from the investigation.

- **Sprint 1 — Home page** (`.ai/lld/home.md`): `frontend/src/app/page.tsx`
  now renders four real sections instead of `PagePlaceholder`, covering
  REQ-BRAND-001, REQ-BRAND-003, REQ-HOME-001 (image slice only),
  REQ-HOME-002, REQ-HOME-003, REQ-HOME-004, REQ-HOME-006.
  REQ-HOME-005 ("Live & Results") remains out of scope — BLOCKED on
  OQ-004/OQ-005, no section built for it.
  - New shared pieces built ahead of the News batch, as Home's LLD
    requires: `src/config/brand.ts` (centralized brand values);
    `src/types/content.ts` (`NewsArticle`/`Champion` types,
    `{ en, vi }`-per-field shape); `src/services/contentService.ts` +
    `src/services/fixtures/{news,champion}.ts` (fixture-backed reads —
    no Django backend exists yet, `ARCHITECTURE.md` §9); `components/ui/
    ErrorMessage`, `components/ui/MediaSlot` (both named in
    `ARCHITECTURE.md` §4, not previously built); `components/features/
    news/ArticleCard` (reused by Hot News; the News page itself —
    listing route, category filter, detail route — is **not** built).
  - New Home section components: `HeroSection`, `MissionOverview`,
    `HotNewsList`, `ChampionsCorner` under `components/features/home/`.
  - **Known, deliberate gap — Champions Corner renders its empty state**:
    no defending-champion record is confirmed anywhere in
    `Requirement_Analysis.xlsx` or `Giai doan 1.docx`; the fixture
    (`CHAMPION_FIXTURE`) is `null` by design rather than inventing a
    specific club/season (`RULES.md` R006). The section and its
    data-fetching path are fully implemented and will show real content
    the moment a record is supplied.
  - **Gap flagged, not resolved**: REQ-HOME-004's "latest/**upcoming**"
    wording — implemented as "3–5 most recent published items" only;
    no OQ covers what "upcoming" means, so a proposed-requirement-change
    is warranted (`RULES.md` R013), not guessed.
  - **Verified**: `tsc --noEmit` clean; `npm run lint` — 0 errors, 1
    pre-existing unrelated warning; `npm test` — 12 suites / 36 tests
    pass (8 new test files added, `routes.test.tsx` updated for Home's
    new heading and extended next-intl/server mock); all 8 routes still
    return 200; EN/VI
    both confirmed on the live route (heading hierarchy h1→h2→h3,
    translated headings/body/alt text, correct 4-article date-descending
    order in both locales); production build compiles and typechecks
    Home's code successfully, then fails at the same **pre-existing**,
    already-documented upstream Next.js `/_global-error` prerender bug
    (identical error digest) — not a regression from this work.
  - **Not verified**: actual rendered-in-browser responsive check at
    specific viewport widths — no Playwright/browser-automation tooling
    is installed in this project or connected in this session. Responsive
    behavior was verified by code/CSS review against the LLD's specified
    breakpoints (`breakpoint-tablet`/`breakpoint-desktop` mixins) only.
  - **Final review pass — 2 confirmed defects found and fixed, LLD
    corrected to match 2 intentional deviations**:
    1. `HeroSection`'s `<section>` used `aria-label={BRAND.tagline}` — a
       second, independent copy of the visible `<h1>` text that could
       drift out of sync. Fixed to `aria-labelledby` pointing at the
       `<h1>`'s `id`, so the landmark name and the visible heading are
       one source of truth.
    2. The error-rendering branch in `HotNewsList` and `ChampionsCorner`
       (both call `contentService` inside a `try`/`catch`) had **zero**
       test coverage — a real gap given error states are an explicit LLD
       requirement. Added a test per component that mocks
       `contentService` to throw and asserts `ErrorMessage` renders with
       `role="alert"` and the correct translated text, and that the
       empty/success branches don't also render. 38/38 tests now pass
       (was 36).
    3. `.ai/lld/home.md` still described the "View all news" link as the
       reused `Button` component and specified a `loading.tsx` skeleton
       — neither matches the actual, already-justified implementation
       (a plain styled `next/link`, and no `loading.tsx` since Home is
       the root route and its data is synchronous fixture reads with no
       real latency to mask). Updated the LLD's text (not the code) to
       match reality, so future LLD-compliance reviews don't re-flag
       intentional, previously-reported decisions as defects.
  - **Re-verified after fixes**: `tsc --noEmit` clean; `npm run lint` —
    0 errors, same 1 pre-existing unrelated warning; `npm test` — 12
    suites / 38 tests pass; production build compiles/typechecks Home's
    code, fails at the identical pre-existing `/_global-error` digest
    (`556520841`) — confirmed not a regression; all 8 routes still 200;
    EN/VI re-confirmed live including the `aria-labelledby` fix and the
    Hot News category-label/formatted-date meta line in both locales
    (previously unverified — e.g. VI renders "1 thg 6, 2026" via
    `next-intl`'s locale-aware formatter, not a hardcoded date string).

- **Sprint 1 — closure validation pass**: re-ran the full checklist against
  the current codebase (not just recalled prior results) before deciding
  whether Sprint 1 could be marked complete.
  - **Re-verified, no regression**: `tsc --noEmit` clean; `npm run lint` —
    0 errors, same 1 pre-existing unrelated warning; `npm test` — 12
    suites / 38 tests pass (unchanged since the last review); production
    build compiles/typechecks, fails at the identical pre-existing
    `/_global-error` digest (`556520841`); all 8 routes return 200 in
    **both** EN and VI (full regression sweep, not just Home's route).
  - **Finding**: About Us, News, and Gallery are unimplemented (see
    **Current state**). Sprint 1's completion criteria ("Home passes,
    About Us passes, News passes, Gallery passes") are not met — 3 of 4
    features cannot pass a validation that has nothing to validate against.
    **Sprint 1 is NOT marked complete.** No code was written to force this
    — implementing 3 unbuilt pages is Sprint 1 *work*, not a defect to fix
    during its *validation*, and doing so unprompted would exceed this
    task's scope ("do not start the next sprint" implies finishing the
    current one is still separate, deliberate work, not a byproduct of a
    validation pass).

- **Sprint 1 — News page** (`.ai/lld/news.md`): `frontend/src/app/news/page.tsx`
  now renders three real, always-visible sections instead of
  `PagePlaceholder` (Tournament News, Inspirational Stories, Knowledge &
  Nutrition), covering REQ-NEWS-001/002/003 in full. New
  `frontend/src/app/news/[slug]/page.tsx` detail route added
  (`REQUIREMENT`: `SPRINT_PLAN.md` describes every News row as
  "listing/detail").
  - **No category filter, no pagination** — per the approved LLD's
    explicit scope boundary, neither is supported by any requirement, so
    neither was built (not even "for later").
  - **New components**: `ArticleList` (`components/features/news`,
    invoked three times — once per category, not a filtered single list)
    and `ArticleDetail` (title/category+date meta/body only, per the LLD).
  - **Reused, not duplicated**: `ArticleCard`, `ErrorMessage`, `Container`
    — all already built during Home's implementation, used here verbatim
    (confirmed identical rendered class names on both pages).
  - **`contentService.ts` extended** with two new pure functions —
    `getNewsByCategory` (no count limit, unlike Home's `getHotNews` 3–5
    cap) and `getArticleBySlug` (detail lookup, feeds Next's `notFound()`
    for unmatched slugs — reuses the existing global `app/not-found.tsx`,
    nothing new built for 404 handling). No new type, no new fixture file
    — reuses `NewsArticle`/`NEWS_FIXTURES` exactly as Home already
    established them.
  - **Verified**: `tsc --noEmit` clean; `npm run lint` — 0 errors, same 1
    pre-existing unrelated warning; `npm test` — 14 suites / 50 tests pass
    (12 new tests: `contentService`'s two new functions, `ArticleList`
    success/empty/error, `ArticleDetail` success/not-found/error); all 8
    top-level routes still 200 in EN and VI; all 4 real article detail
    routes return 200, an unknown slug returns 404; production build
    compiles/typechecks News' code successfully, then fails at the same
    **pre-existing**, already-documented upstream Next.js `/_global-error`
    digest (`556520841`) — not a regression. EN/VI confirmed live on both
    routes (section headings, category labels, article titles/body, and
    the detail page's `<h1>` all correctly translated; dates formatted via
    `next-intl`, e.g. "Jun 1, 2026" / "1 thg 6, 2026").
  - **Not verified**: rendered-in-browser responsive check at specific
    viewport widths (same tooling gap as Home — no Playwright/browser
    automation available); the 404 page's exact body text (Next's dev-mode
    error-boundary streaming means `curl` only sees the 404 status code
    and an error digest marker, not the hydrated "Not Found" text — a
    `curl`-vs-real-browser tooling limitation, not a functional defect;
    the `notFound()` call and resulting 404 status were both confirmed).
  - **OQ dependencies**: none — all three News requirements are READY
    with no linked Open Question, unlike Home (`OQ-003`) or About
    (`OQ-006`).

- **Sprint 1 — About Us page** (`.ai/lld/about.md`): `frontend/src/app/about/page.tsx`
  now renders three real sections instead of `PagePlaceholder` (Brand
  Story, Tournament System, Organizing Committee & Partners), covering
  REQ-ABOUT-001/002/003. Brand Story's heading is the page's `<h1>` (no
  hero/media section exists on this page to host one separately).
  - **New components**: `BrandStory`, `TournamentSystemSection`,
    `PartnersSection` (`components/features/about`) — exact names
    `ARCHITECTURE.md` §4 reserves — and `PartnerCard` (built on the
    existing `Card` primitive, static display, not a link — no
    requirement specifies a partner profile page to link to).
  - **Reused, not duplicated**: `Card`, `Container`, `ErrorMessage`,
    `LocalizedText` type, and the section-as-async-function-composed-via-
    `Promise.all` page pattern — all already established by Home/News.
  - **`contentService.ts` extended** with one new function —
    `getPartners()` — backed by a new, empty `PARTNERS_FIXTURE` array. No
    committee/partner entry is confirmed anywhere in the requirements
    workbook, so (following the exact precedent set by Home's
    `CHAMPION_FIXTURE`) the section renders its designed empty state
    rather than inventing a specific organization or person's name
    (`RULES.md` R006). One new `Partner` type added to
    `src/types/content.ts` — `name`/`role`/`logo?` only, no fields beyond
    what the requirement text supports.
  - **REQ-ABOUT-002 (`OQ-006` partial block)**: structure/heading/layout
    fully built; body copy is intentionally generic and names no specific
    technical/referee/international standards body, since that's exactly
    what `OQ-006` asks the client to confirm.
  - **Verified**: `tsc --noEmit` clean; `npm run lint` — 0 errors, same 1
    pre-existing unrelated warning (one new warning surfaced and was
    fixed during this pass — an unnecessary `eslint-disable` comment for
    a rule not active in this project's config, removed); `npm test` —
    18 suites / 62 tests pass (12 new tests: `contentService`'s
    `getPartners`, `BrandStory`, `TournamentSystemSection`, `PartnerCard`,
    `PartnersSection` success/empty/error); all 8 top-level routes still
    200 in EN and VI, explicitly re-checked that Home's and News' routes
    (including a News detail route) are unaffected; production build
    compiles/typechecks About's code successfully, then fails at the same
    **pre-existing**, already-documented upstream Next.js `/_global-error`
    digest (`556520841`) — not a regression. EN/VI confirmed live
    (Brand Story/Tournament System headings and body, Partners' empty-
    state message, correct h1→h2→h2 hierarchy in both locales).
  - **Not verified**: rendered-in-browser responsive check at specific
    viewport widths (same tooling gap as Home/News — no Playwright/
    browser automation available in this project or session).
  - **OQ dependencies**: `OQ-006` (Tournament System specific standards —
    copy slice only; structure and generic copy proceed).

- **Sprint 1 — Gallery page** (`.ai/lld/gallery.md`): `frontend/src/app/gallery/page.tsx`
  now renders three real sections instead of `PagePlaceholder`
  (Championship Moments Library, MVP Spotlight, Behind-the-Scenes
  Stories), covering REQ-GALLERY-001 (photo slice only),
  REQ-GALLERY-002, REQ-GALLERY-003 in full.
  - **New components**: `MediaAlbum`, `MVPSpotlightCard`,
    `BehindScenesEssay` (`components/features/gallery` — exact names
    `ARCHITECTURE.md` §4 reserves), plus `PhotoThumbnail` (a single
    non-interactive photo tile, reused across all three sections) and
    `BehindScenesSection` (owns the heading/list/empty/error state around
    N `BehindScenesEssay` items, mirroring `ArticleList`/`PartnersSection`).
    No lightbox/`Modal` was built — no requirement describes a zoom/expand
    interaction, and the prior LLD draft's plan to add one was removed
    during the LLD refresh.
  - **Reused, not duplicated**: `Card`, `Container`, `ErrorMessage`, the
    `LocalizedText` type, and the section-as-async-function-composed-via-
    `Promise.all` page pattern — all already established by Home/News/About.
  - **`contentService.ts` extended** with three new functions —
    `getChampionshipPhotos()`, `getMvpSpotlight()`,
    `getBehindScenesStories()` — each backed by a new, **empty/null**
    fixture, per the refreshed LLD: no photo, MVP record, or story is
    confirmed anywhere in the requirements workbook, so (following the
    exact precedent of Home's `CHAMPION_FIXTURE` and About's
    `PARTNERS_FIXTURE`) all three render their designed empty state
    rather than inventing specific factual/pictorial content
    (`RULES.md` R006). Two new types added to `src/types/content.ts` —
    `MvpSpotlight`, `BehindScenesStory` — no shared `Photo` type was
    extracted (the existing inline `{ src, alt }` shape was repeated,
    per the LLD's explicit instruction not to add one unless required).
  - **REQ-GALLERY-001's video half — explicitly NOT implemented**: no
    Open Question tracks it (a genuine gap, unlike Home's `OQ-003`), and
    per the task boundary this was not resolved, guessed, or scaffolded
    in any way (no reserved type variant, no placeholder UI). It remains
    open and is not treated as complete.
  - **Verified**: `tsc --noEmit` clean (checked after each of the 4
    implementation batches, not only at the end); `npm run lint` — 0
    errors, same 1 pre-existing unrelated warning; `npm test` — 23 suites
    / 82 tests pass (20 new tests: `contentService`'s three new
    functions, `PhotoThumbnail`, `MediaAlbum`, `MVPSpotlightCard`,
    `BehindScenesEssay`, `BehindScenesSection` success/empty/error/no-photo
    cases); all 8 top-level routes still 200 in EN and VI; explicitly
    re-checked that Home's, News' (including a detail route), and About's
    headings/routes are unaffected; production build compiles/typechecks
    Gallery's code successfully, then fails at the same **pre-existing**,
    already-documented upstream Next.js `/_global-error` digest
    (`556520841`) — not a regression. EN/VI confirmed live: all three
    section headings (using `REQUIREMENTS.md`'s own wording) and all
    three empty-state messages, correct h1→h2→h2→h2 hierarchy in both
    locales.
  - **Not verified**: rendered-in-browser responsive check at specific
    viewport widths — no Playwright/browser-automation tooling is
    installed in this project or connected in this session (same gap as
    Home/News/About). Reported explicitly rather than assumed passing.
  - **OQ dependencies**: none logged. REQ-GALLERY-001's video half is a
    gap, not an OQ — flagged as a candidate for a new proposed Open
    Question, not created here.

- **Sprint 1 — final acceptance review**: re-ran the full validation
  checklist fresh across all four pages together (not per-page in
  isolation) before deciding whether to mark Sprint 1 complete.
  - **Re-verified, no regression**: `tsc --noEmit` clean; `npm run lint`
    — 0 errors, same 1 pre-existing unrelated warning; `npm test` — 23
    suites / 82 tests pass; production build compiles/typechecks, fails
    at the identical pre-existing `/_global-error` digest
    (`556520841`); all 8 routes return 200 in both EN and VI; all 4 real
    News detail routes return 200, an unknown slug returns 404.
  - **Requirement traceability audit**: 19 files/pages carry explicit
    `REQ-*` comments; the one exception (`PhotoThumbnail`) is a
    cross-cutting presentational primitive reused across three
    requirements, documented the same way `Card`/`Container`/
    `ErrorMessage`/`MediaSlot` already are — consistent with the
    established pattern, not a gap.
  - **Design-system/component-reuse audit**: `Card` reused in 5 places,
    `ErrorMessage` in 8; every list/grid section (`HotNewsList`,
    `ArticleList`, `PartnersSection`, `MediaAlbum`, `BehindScenesSection`)
    uses the identical 1/2/3-column breakpoint rule — no drift, no
    duplicate primitive introduced anywhere in the Sprint.
  - **Heading hierarchy re-confirmed live** on all four pages in both
    locales — sequential h1→h2 (→h2 for multi-section pages), no skipped
    levels, no stray heading.
  - **Scope audit**: grepped all Sprint-1 feature code for
    Club/Tournament/Auth/Registration/Dashboard terms — every match is a
    benign label (e.g. `clubName` as flat editorial text, `tournament_news`
    as a News category) with no real Sprint-2 data-model or auth code
    present.
  - **OQ audit**: confirmed against `REQUIREMENTS.md` directly — all 15
    Open Questions still listed as `Open`; none resolved or closed by
    this or any prior review.
  - **Finding**: no defect found that would block Sprint 1 acceptance.
    Nothing was fixed because nothing needed fixing this pass.
  - **Not verified** (unchanged from every prior page-level check):
    rendered-in-browser responsive verification at specific viewport
    widths — no Playwright/browser-automation tooling exists in this
    project or session.

- **Sprint 2 Batch 1 — Club domain data model** (`.ai/lld/clubs.md`,
  reviewed and marked READY FOR IMPLEMENTATION before this batch began):
  - **New `backend/` Django project** (first backend code in the repo):
    `config/` (settings/urls/wsgi/asgi + a minimal infra-only `/health/`
    view, no Requirement ID — matches `ARCHITECTURE.md` §9's pre-planned
    healthcheck design), `clubs` app (`Club` model + admin), `players`
    app (`Player`/`CoachStaff` models + admin). `django.contrib.auth` is
    enabled only because Django admin requires it to function — this is
    Django's own built-in login, not the project's future `accounts` app,
    and does not answer `OQ-012`.
  - **Models — only CONFIRMED/DERIVED fields, nothing
    REQUIRES_CONFIRMATION added**: `Club.name`/`logo`/`founding_year`/
    `achievements` (REQ-CLUB-004), `province_region` (REQ-CLUB-002),
    `contact_info`/`social_links` (REQ-CLUB-006), `is_approved`
    (BR-001/REQ-CLUB-003, defaults `False`); `Player.name`/`club` and
    `CoachStaff.name`/`club` (REQ-CLUB-005 — name only, no position/
    jersey/birthdate/title, per the LLD). `achievements`/`contact_info`/
    `social_links` use `JSONField` — their *existence* is confirmed, their
    *shape* is not, so a schema-flexible column was chosen instead of
    pre-committing to a structure. `logo` is a plain `CharField` (URL/path
    reference) — no upload/storage mechanism is confirmed by any
    requirement, so no `ImageField`/upload handling was built.
  - **Relationships**: `Club (1)── (N) Player`, `Club (1) ── (N)
    CoachStaff`, both `on_delete=CASCADE`. No relationship to
    Tournament/Season/Match/Standing (Sprint 4), Account (Backlog,
    `OQ-012`), or Document/Upload (Sprint 3, `OQ-011`) — none of those
    exist in this batch.
  - **Migrations**: `clubs/migrations/0001_initial.py` (CreateModel:
    `Club`), `players/migrations/0001_initial.py` (CreateModel:
    `Player`, `CoachStaff`, depends on `clubs.0001_initial`). Inspected
    directly — both contain only `CreateModel` operations, nothing
    destructive. Applied cleanly to a real Postgres 16 database; schema
    verified column-by-column via `psql \d` against the LLD (correct
    `NOT NULL` on `name`/`province_region`/`is_approved`, nullable on the
    rest, correct FK references). `makemigrations --check --dry-run`
    confirms zero model/migration drift.
  - **Known nuance, not a defect**: Django's `on_delete=CASCADE` is
    enforced by Django's ORM `Collector` in Python, not as a raw Postgres
    `ON DELETE CASCADE` constraint (`confdeltype` is `a`/"no action" at
    the database level) — this is standard Django behavior and only
    cascades through ORM deletes, which is the only way this app ever
    deletes data (`RULES.md` R019 — no raw SQL, no direct Postgres
    access from the frontend).
  - **Verified**: `python manage.py check` — 0 issues; 18 new
    `pytest-django` model tests pass (defaults, required-field
    validation, optional-field absence, JSON-shape flexibility,
    relationship/cascade behavior) — all on the first run; frontend
    fully re-verified untouched (`tsc`, `eslint` n/a here, `jest` — 23
    suites / 82 tests, unchanged); all 8 Sprint-1 routes still 200;
    `docker compose down` → `up` full-cycle restart confirmed the
    `postgres_data` named volume persists migrations correctly; `/health/`
    returns `200 {"status": "ok"}` (DB reachable), `/admin/` returns 302
    (redirect to login, correct unauthenticated behavior).
  - **Not built this batch** (explicitly, per task scope): DRF
    serializers/viewsets, RBAC, authentication, Club Dashboard, roster/
    athlete management, statistics, live scores, Directory UI, Profile
    UI, email notifications, seed/fixture data (deferred to whichever
    batch first needs something to display — creating club names/content
    now would be inventing data ahead of need).
  - **OQ dependencies**: `OQ-009` (Directory map slice — untouched by the
    data model), `OQ-010` (blocks anything beyond the plain `is_approved`
    boolean; Django-admin seeding this batch answers neither `OQ-010` nor
    `OQ-012`). No OQ was resolved.

- **Sprint 2 Batch 2 — RBAC foundation**: permission matrix derived
  strictly from confirmed requirements before any code was written.

  | Role | Confirmed permission this batch | Why not more |
  |---|---|---|
  | **Guest** | Read approved `Club`s only (`Club.objects.approved()`) | Full REQ-CLUB-001–006 scope, nothing beyond public read |
  | **System Admin** | None as a *named role* — Django's built-in superuser bypasses all permission checks (pre-existing since Batch 1), which is not the same as confirming "System Admin" as a product role | `OQ-010` — real approver identity/role is undecided |
  | **Club Manager** | None | Club Dashboard (REQ-REG-004) is Backlog/BLOCKED (`OQ-012`); this batch's rules also forbid deciding account creation |
  | **Content Editor** | None | Zero evidence anywhere in the workbook tying this name to any permission in the Club domain (or any domain) |

  - **Implemented** (the one confirmed boundary, plus Django's own
    permission system applied to it — no new dependency, no DRF):
    - `ClubQuerySet.approved()` — a queryset method (not the default
      manager) returning only `is_approved=True` clubs. `Club.objects.all()`
      stays unfiltered so admin continues to see unapproved clubs to
      approve them — required for Batch 1's already-tested seeding flow
      to keep working.
    - `Club.Meta.permissions = [("approve_club", "Can approve club")]` —
      a distinct Django permission naming the approval action BR-001
      already confirms exists, **not assigned to any user or group**.
      WHO gets it is `OQ-010`'s question, not decided here.
    - `ClubAdmin.get_readonly_fields()` — makes `is_approved` read-only
      in the admin change form for anyone lacking `clubs.approve_club`.
      Superusers bypass this automatically (Django's own `has_perm`
      behavior, not new logic) — matching Batch 1's existing seeding
      flow exactly, no behavior change for the one workflow that already
      existed.
  - **Not implemented** (per this task's explicit rules — nothing
    guessed): Google login, email approval notifications, Club Manager
    account creation, the final Club approval workflow, Club Dashboard
    UI, Club registration UI, roster management, any Django Group for
    System Admin/Club Manager/Content Editor (would have zero permissions
    to attach — inert scaffolding, not built).
  - **Tests — 9 new, 27 total in the backend, all passing on first
    correct run**: `Club.objects.approved()` correctness; default
    manager stays unfiltered; anonymous denied `/admin/`; authenticated
    non-staff denied `/admin/`; staff with only `view_club` gets
    read-only access (200, not 403 — Django's actual behavior, an
    incorrect test assumption was caught and fixed during this batch);
    staff with zero `clubs` permissions gets a real 403; staff with
    `change_club` but not `approve_club` sees `is_approved` as read-only;
    staff with `approve_club` can edit it; superuser can edit it without
    any explicit grant.
  - **Verified**: `python manage.py check` — 0 issues; new migration
    `clubs/migrations/0002_alter_club_options.py` inspected directly —
    contains only `AlterModelOptions` (permission metadata), no schema/
    column change, nothing destructive; `makemigrations --check` — zero
    drift; frontend fully re-verified untouched (`tsc` clean, 23 suites /
    82 Jest tests, all 8 Sprint-1 routes 200); full `docker compose
    down`/`up` restart cycle confirmed both migrations persist correctly
    via the `postgres_data` volume.
  - **OQ dependencies**: `OQ-010` (real approval authority/role — nothing
    beyond the `approve_club` permission's bare existence is decided),
    `OQ-012` (Club Dashboard auth method — untouched; no `accounts` app,
    no custom `User` extension, no login flow was built).

- **Sprint 2 Batch 3 — Public Club Directory** (`.ai/lld/club-directory.md`,
  authored and marked `DIRECTORY_LLD_READY` before this batch began):
  - **Backend — first DRF endpoint in the project**:
    `djangorestframework>=3.15,<3.16` added to `backend/requirements.txt`
    (previously deferred — no batch had used it until now);
    `"rest_framework"` added to `INSTALLED_APPS`;
    `REST_FRAMEWORK = {"DEFAULT_PERMISSION_CLASSES": ["...AllowAny"]}`
    added to `settings.py` (DRF's own default, made explicit since the
    Directory is entirely public — Guest, `.ai/lld/club-directory.md`
    §18). `clubs/serializers.py` (`ClubListSerializer` — `id`/`name`/
    `logo`/`founding_year`/`achievements`/`province_region` only, no
    `is_approved`/`contact_info`/`social_links`), `clubs/views.py`
    (`ClubListView(generics.ListAPIView)` — not a full ViewSet/router, no
    confirmed write operation exists), `clubs/urls.py` +
    `config/urls.py`'s new `path("api/", include("clubs.urls"))`. The
    view's `get_queryset()` calls `Club.objects.approved()` (Batch 2's
    tested Guest boundary) — never the unfiltered default manager —
    filtered further by an optional `?province_region=` query param
    (`DERIVED`, REQ-CLUB-002).
  - **Frontend — first real (non-fixture) service in the project**:
    `src/types/club.ts` (`Club` interface mirroring the serializer's
    payload exactly) and `src/services/clubsService.ts` (`getClubs()`,
    `fetch(..., { cache: "no-store" })`, throws on a non-ok response).
    Reads `process.env.API_BASE_URL` (no `NEXT_PUBLIC_` prefix) — all
    Club data fetching happens server-side in Next.js Server Components
    over the Docker-internal network, so no CORS configuration was
    needed. `frontend/.env.example` and `docker-compose.yml`'s `frontend`
    service updated (`API_BASE_URL=http://backend:8000` via the existing
    `env_file`; added `depends_on: backend: condition: service_healthy`).
  - **New components** (`components/features/clubs/` — exact names
    `ARCHITECTURE.md` §4 reserves, no renames/extras): `ClubProfileCard`
    (scoped this batch to REQ-CLUB-004's fields + `province_region` only
    — roster/coaching-staff/contact/social-links are Profile-page
    content, not built yet; a `formatAchievements()` helper renders a
    short excerpt from a `string` or `string[]` achievements value,
    truncated at 120 chars, since the field's shape is still
    `REQUIRES_CONFIRMATION` per `.ai/lld/clubs.md` §12); `ClubDirectoryFilter`
    (Client Component, matches the `LanguageSwitcher` precedent — a
    native `<select>` of the region values found in the unfiltered
    result, pushes `?region=<value>` via `next/navigation`, no free-text
    search); `ClubDirectoryList` (async Server Component, presentational
    only — grid or empty state, no fetching of its own).
  - **`app/clubs/page.tsx` rewritten** (was `PagePlaceholder`): the
    two-fetch strategy the LLD specifies — fetches the unfiltered list
    once (to derive the filter's region options), and only fetches again
    with `?province_region=` when `searchParams.region` is present (no
    redundant call in the common, unfiltered case). Both calls run inside
    one `try`/`catch`; on failure the shared `ErrorMessage` primitive
    renders instead of the list. `ClubDirectoryList` is invoked and
    awaited directly (`await ClubDirectoryList({ clubs })`, embedded as
    `{clubDirectoryList}`), not nested as `<ClubDirectoryList />` JSX —
    the same corrected async-Server-Component composition pattern
    already required by Home/News/About, since it's an async component.
  - **`app/clubs/loading.tsx` added — first `loading.tsx` in the
    project**: a static skeleton grid, justified because the Club
    Directory is the first page whose data comes from a real network
    call (Next.js → Django), unlike every Sprint 1 page's synchronous
    fixture reads.
  - **`messages/{en,vi}.json` extended** with `clubs.directory.{filterLabel,
    allRegions,empty,error}` — `Club.name`, `achievements`, and
    `province_region` all render as-is (not translated), per the LLD's
    explicit i18n boundary (§14).
  - **Verified**: `python manage.py check` — 0 issues; `makemigrations
    --check --dry-run` — zero drift (no model change this batch); 6 new
    backend tests (approved-only filtering, unauthenticated access,
    region filtering, unfiltered-returns-all-regions, private/
    Profile-only field exclusion, empty result) — 33/33 backend tests
    pass. `tsc --noEmit` clean; `eslint` — 0 errors/warnings; 22 new
    frontend tests (`clubsService` URL/query-param/error-handling,
    `ClubProfileCard` link/logo/founding_year/achievements-excerpt/
    truncation, `ClubDirectoryFilter` region options/push-URL behavior,
    `ClubDirectoryList` grid/empty state, `ClubsPage`'s two-fetch
    orchestration and error state) — 105/105 frontend tests pass, plus
    `routes.test.tsx` updated (mocks `clubsService`/`next-intl`/
    `next/navigation`, calls `ClubsPage({ searchParams: Promise.resolve({}) })`).
    End-to-end verified live through Docker (seeded 3 clubs — 2 approved
    across 2 regions, 1 unapproved — via the backend shell, then removed
    afterward, matching Batch 1/2's no-permanent-seed-data precedent):
    `GET /api/clubs/` and `/clubs`, `/clubs?region=Hanoi`, and
    `/clubs?region=<no-match>` all returned exactly the expected clubs/
    fields/empty-state, and the unapproved club never appeared.
  - **Not built this batch** (explicitly out of scope): Club Profile
    (`[clubId]/page.tsx` — card links to `/clubs/{id}`, currently 404s
    via the existing global `not-found.tsx`, an accepted temporary gap
    from sequencing), Club Dashboard, registration, map view/toggle
    (`OQ-009`), pagination/infinite scroll, free-text search — none
    confirmed by any requirement.
  - **OQ dependencies**: `OQ-009` (blocks the map slice entirely — not
    resolved; checked directly against `REQUIREMENTS.md`'s exact
    wording). `OQ-010` is irrelevant to this batch — the Directory only
    *reads* `is_approved` via the existing boundary, it doesn't decide
    who sets it.

- **Sprint 2 Batch 4 — Public Club Profile** (`.ai/lld/club-profile.md`,
  authored and marked `PROFILE_LLD_READY` before this batch began):
  REQ-CLUB-003 (display gate)/004/005/006.
  - **Backend**: `players/serializers.py` (new file) —
    `PlayerSerializer`/`CoachStaffSerializer` (`id`/`name` only),
    owned by the `players` app so `clubs`' serializer never defines
    fields against `players`' models directly (`ARCHITECTURE.md` §12
    constraint 6). `clubs/serializers.py` gains `ClubDetailSerializer`
    (imports the two serializers above; fields: `id`/`name`/`logo`/
    `founding_year`/`achievements`/`province_region`/`contact_info`/
    `social_links`/`players`/`coach_staff` — never `is_approved`).
    `clubs/views.py` gains `ClubDetailView(generics.RetrieveAPIView)`,
    `get_queryset()` returning `Club.objects.approved()` (same Batch 2
    boundary as the list view, never `.all()`) — DRF's own default
    `RetrieveAPIView` behavior against a queryset excluding the
    requested pk already produces a 404, which is what makes an
    unapproved club indistinguishable from a nonexistent one, no extra
    code needed. `clubs/urls.py` gains `clubs/<int:pk>/` →
    `club-detail`. **No model change, no migration** — every field this
    batch serves already existed on `Club`/`Player`/`CoachStaff` from
    Batch 1.
  - **Frontend — new components** (`components/features/clubs/`, exact
    names `.ai/lld/club-profile.md` §4 designs): `ClubProfileHeader`
    (name/logo/founding_year/province_region), `ClubAchievements`,
    `ClubRoster`, `ClubCoachingStaff`, `ClubContactSection`
    (contact_info + social_links, one component for REQ-CLUB-006's one
    requirement). Each confirmed-empty section (achievements/roster/
    coaching staff/contact/social) renders its own empty-state message,
    matching the sitewide list-section precedent (`PartnersSection`,
    `HotNewsList`, etc.) — never a fabricated value.
  - **Shared shape-defensive parsing extracted and reused**:
    `src/lib/clubFields.ts` (`formatTextListField`, `isUrlLike`) —
    generalizes `ClubProfileCard`'s existing string/string[]-only
    `achievements` parsing (shape is `REQUIRES_CONFIRMATION` per
    `.ai/lld/clubs.md` §2-3) into one helper reused by `ClubProfileCard`
    (Directory, still truncated) and the three new Profile sections
    that face the identical unconfirmed-shape problem (achievements,
    contact_info, social_links — untruncated, full text). A social link
    only becomes a clickable `<a href>` when it's already a well-formed
    `http(s)://` string; anything else (an object, a bare domain, etc.)
    renders as plain text or falls back to the empty state — no
    `{platform, url}` structure is guessed.
  - **Frontend — service/types**: `clubsService.ts` gains `getClubById`
    — a `404` response resolves to `null` (page calls `notFound()`); any
    other non-OK status throws (page renders `ErrorMessage`). `types/club.ts`
    gains `ClubDetail`/`ClubRosterMember` (additive; the existing `Club`
    list-view interface is unchanged).
  - **New route**: `app/clubs/[clubId]/page.tsx` — fills the slot
    `ARCHITECTURE.md` §4 already reserved; `ClubProfileCard`'s existing
    `/clubs/{id}` link (built Batch 3, previously 404ing) now resolves.
  - **Genuine implementation-discovered constraint, resolved**: a
    `loading.tsx` anywhere in the `/clubs` ancestor chain locks the HTTP
    response status at 200 once Suspense streaming begins, incompatible
    with `notFound()`'s required 404. No `loading.tsx` was shipped for
    `[clubId]`, and the pre-existing `/clubs/loading.tsx` (Batch 3) was
    **removed** — both routes now render without a skeleton, matching
    every Sprint 1 page. Full account: `.ai/lld/club-profile.md` §8/§21,
    `.ai/lld/club-directory.md` §10.
  - **i18n**: `messages/{en,vi}.json` gain `clubs.profile.*` (section
    headings, per-section empty-state text, page-level error text).
    `Club.name`/roster/coaching-staff names are proper nouns, not
    translated; `achievements`/`contact_info`/`social_links` render
    as-is in whichever language was entered, no locale-switching — same
    already-flagged limitation as Batches 1/3 (`.ai/lld/clubs.md` §12).
  - **Verified**: `python manage.py check` — 0 issues; `makemigrations
    --check --dry-run` — zero drift (no model change); 7 new backend
    tests (full field set for an approved club, `is_approved` excluded,
    nested players/coach_staff present, empty roster/staff, unapproved
    → 404, nonexistent → 404, unauthenticated access) — 40/40 backend
    tests pass. `tsc --noEmit` clean; `eslint` — 0 errors, same 1
    pre-existing unrelated warning; 42 new frontend tests (`clubFields`
    parsing/URL-detection, `getClubById`'s 404/error/success branches,
    each new component's success/empty/heading-hierarchy cases, the
    page's success/`notFound()`/error-fallback cases) — 35 suites / 147
    frontend tests pass. Production build compiles/typechecks this
    batch's code successfully, then fails at the same **pre-existing**,
    already-documented upstream Next.js `/_global-error` digest
    (`556520841`) — not a regression.
    **Live end-to-end verification through Docker** (seeded 3 temporary
    clubs — 1 fully-populated approved, 1 minimal approved, 1
    unapproved — via the backend shell, then removed afterward, same
    no-permanent-seed-data precedent as Batches 1–3): confirmed live —
    an approved club with full data renders all 5 sections with correct
    h1→h2→h2→h2→h2(+h3) heading hierarchy, correct logo `alt` text, and
    a linkified social URL (`target="_blank" rel="noopener noreferrer"`);
    a minimal approved club renders all 5 empty-state messages; an
    unapproved club and a nonexistent id both return a real HTTP `404`;
    stopping the backend mid-request renders `ErrorMessage` (not a
    crash) on both the Profile and Directory pages; the Directory list,
    its region filter, and its card links to `/clubs/{id}` all still
    work unmodified; all 8 top-level routes return 200 in **both** EN
    and VI, including the Profile page's fully-translated headings/
    empty-state text and the 404 behavior holding in both locales.
  - **Not built this batch** (explicitly out of scope, none confirmed by
    any requirement): statistics, Club Dashboard/registration links, any
    visible approval-status indicator (`is_approved` stays server-side
    only — never serialized, never rendered, per `.ai/lld/clubs.md` §9 and
    `.ai/lld/club-profile.md` §7's explicit clarification that the
    "display gate" means access control, not a visible badge), a
    back-to-directory link (no requirement basis; matches `ArticleDetail`'s
    existing no-back-link precedent), roster/coach fields beyond `name`,
    richer `contact_info`/`social_links` structure.
  - **OQ dependencies**: `OQ-010` (blocks only the approval *action* —
    unchanged boundary from Batch 2/3; the display gate itself is not
    blocked, `Club.objects.approved()` already implements it). `OQ-009`
    is irrelevant (no map on a Profile page). No OQ was resolved.

- **Sprint 3 — Club Registration** (`.ai/lld/club-registration.md`,
  authored and independently reviewed before this batch began — marked
  `REGISTRATION_LLD_READY`, 3 documentation-accuracy fixes made during
  review, see that document's §20): REQ-REG-001/002/003.
  - **Backend — `Club` model extended, additively**: `representative_name`
    (`CharField`, required at the serializer layer — no model-level
    default, matching `name`'s style; existence `CONFIRMED`,
    required-ness a stated design decision, not a strict `DERIVED`
    necessity, per the LLD's own review-pass correction),
    `capability_profile`/`u20_athlete_list` (`FileField`, optional,
    UUID-based `upload_to` path — `clubs/registrations/<uuid4>/<filename>`,
    avoids Django's new-object-has-no-pk `upload_to` ordering problem).
    New migration `clubs/migrations/0003_club_registration_fields.py` —
    3 `AddField` operations only, no `AlterField`, no data migration;
    `representative_name`'s one-off `""` default is a migration-tooling
    necessity (`preserve_default=False`), not a permanent model default —
    confirmed by inspecting the generated SQL/schema directly (`\d
    clubs_club`: `representative_name` is `NOT NULL` with **no** stored
    column default, exactly matching `name`'s existing shape).
  - **`ClubRegistrationSerializer`** (`clubs/serializers.py`) — `id`
    (read-only), `name`, `province_region`, `representative_name`
    (required), `capability_profile`, `u20_athlete_list` (optional).
    `is_approved` is not a field on it at all — verified directly (both
    by code inspection and a live request with `is_approved=true` in the
    POST body) that a client-supplied value is silently dropped, never
    applied; every created row's `is_approved` stays the model's own
    `False` default.
  - **`ClubListView` → `ClubListCreateView`** (`generics.ListCreateAPIView`,
    `clubs/views.py`) — same URL/name (`club-list`); `GET` behavior
    (serializer, `Club.objects.approved()` boundary, `province_region`
    filter) is byte-for-byte unchanged; `POST` is new.
    `ClubDetailView`/`ClubDetailSerializer` (Batch 4) and
    `players/models.py`/`players/serializers.py` (Batch 1/4) are
    untouched — confirmed by direct inspection, not just by not editing
    them.
  - **File storage**: `MEDIA_ROOT`/`MEDIA_URL` added to `settings.py`;
    `config/urls.py` serves `MEDIA_URL` only when `DEBUG` (no production
    media-serving mechanism exists, matching this project's current
    dev-only deployment posture); new named, persistent `backend_media`
    Docker volume (never anonymous, same rule as `postgres_data`).
  - **No `OQ-011` decision made anywhere**: no `accept` attribute on
    either file input, no server-side MIME/extension allow-list, no
    file-size rejection, no model-level file validators. Verified live:
    a `.txt` file and a file with arbitrary content both upload
    successfully with no restriction.
  - **Frontend — new `components/ui` primitives** (reserved names,
    never built before this batch): `Input`, `Label`, `FormField`
    (composes `Label`+`Input`+an inline `role="alert"` error region,
    linked via `aria-describedby`). **New `components/features/registration`**:
    `RegistrationForm` (Client Component, uncontrolled — native
    `defaultValue`/`FormData`, no field-level React state; submits via
    `useActionState` + `<form action={...}>`, React 19's own form-action
    integration) and `FileUploadField` (no `required`, no `accept`).
  - **`club-registration/actions.ts`** — `"use server"` Server Action
    (`submitClubRegistrationAction`), following the exact precedent
    already set by `src/i18n/actions.ts`'s `setLocaleAction`: the
    browser's `FormData` (including files) is submitted to this Next.js
    server action, which forwards it unmodified to Django via
    `clubsService.registerClub` — the browser never talks to the
    backend directly, no CORS configuration added or needed.
  - **`clubsService.registerClub`** — `201` → success echo; `400` →
    DRF's own per-field messages passed through as-is (no translated
    backend validation copy authored); any other outcome → a
    `networkError` result, rendering the shared `ErrorMessage`, same
    pattern as the Directory/Profile.
  - **i18n**: `messages/{en,vi}.json` gain a `clubRegistration.form.*`
    namespace (field labels, submit button, success/error copy).
    Verified live in both locales, including the apostrophe in
    "Representative's name" rendering correctly and Vietnamese
    diacritics rendering correctly.
  - **Verified**: `python manage.py check` — 0 issues; `makemigrations
    --check --dry-run` — zero drift (the hand-written migration exactly
    matches the model state, confirmed rather than assumed); 19 new
    backend tests (representative_name required at validation but not
    at the ORM level — confirmed pre-existing seed-data call sites are
    unaffected; optional file fields; registration creates an unapproved
    club; `is_approved` cannot be client-set; required-field 400s;
    optional/arbitrary file upload succeeds; new unapproved
    registrations stay invisible in the Directory list; both the
    Directory list and Profile detail responses exclude all three new
    fields) — 59/59 backend tests pass. `tsc --noEmit` clean; `eslint` —
    0 errors, same 1 pre-existing unrelated warning; 39 new frontend
    tests (`Input`/`Label`/`FormField`/`FileUploadField` unit tests, the
    Server Action's own logic against a mocked `clubsService`, and
    `RegistrationForm`'s success/field-error/network-error branches —
    the last three required dispatching `fireEvent.submit()` on the
    form element directly rather than clicking the submit button, a
    known React 19 + jsdom compatibility gap unrelated to this
    component's own correctness) — 41 suites / 170 frontend tests pass.
    Production build compiles/typechecks this batch's code successfully,
    then fails at the same **pre-existing**, already-documented upstream
    Next.js `/_global-error` digest (`556520841`) — not a regression.
    **Live end-to-end verification through Docker** (seeded, then
    removed, temporary clubs/files — same precedent as every prior
    batch): a real multipart `POST` with an uploaded file succeeds
    (`201`, correct UUID storage path, file confirmed on disk in the
    persistent volume); attempting `is_approved=true` in the same
    request is silently ignored (row created with `is_approved=False`,
    confirmed directly in the database, not just via the API response);
    a missing required field returns DRF's standard `400`; the new
    unapproved club never appears in `GET /api/clubs/`; the registration
    page renders correctly in both EN and VI; all 8 top-level routes
    return 200 in both locales; the Directory list, the Profile page
    (including an approved club's roster), and the existing
    unapproved/nonexistent-club 404 behavior (Batch 4) are all
    unaffected; stopping the backend mid-request still renders the
    shared `ErrorMessage` on both the Directory and Profile pages.
  - **Not built this batch** (explicitly out of scope, none confirmed by
    any requirement): Club Dashboard, any authentication/login/account-
    activation mechanism, the approval workflow or any approval UI,
    email notification, roster/personnel update via a Dashboard, any
    resolution of `OQ-011`/`OQ-012`/`OQ-013`.
  - **Known limitation**: uploaded documents are served at an
    unauthenticated (UUID-unguessable, not access-controlled) `/media/`
    URL in dev — flagged explicitly in the LLD (§7) as a known,
    unresolved gap consistent with no authentication mechanism existing
    anywhere in this project yet (`OQ-012`), not a new gap introduced
    here. No rate-limiting/anti-spam/duplicate-submission detection on
    the registration endpoint — not requested by any requirement.
  - **OQ dependencies**: `OQ-011` (file format/size validation — not
    resolved, only the storage mechanism was built). `OQ-012`/`OQ-013`
    are untouched (Club Dashboard is not this batch's scope). No OQ was
    resolved.

- **Post-Sprint-3 — Club Registration first-visit animated intro** (UX
  enhancement, `.ai/lld/club-registration.md` §21 — **no Requirement ID**,
  not sourced from `Requirement_Analysis.xlsx`; directly requested with a
  full, unambiguous spec and flagged as such rather than folded silently
  into REQ-REG-001): a first-visit-only branding intro (`RegistrationIntro`
  + `RegistrationIntroGate`, `components/features/registration/`) shown
  before the existing, unmodified `<h1>` + `RegistrationForm` on
  `/club-registration`. The route named in the originating request
  (`/clubs/register`) doesn't exist in this codebase — confirmed with the
  requester before implementation that the actual `/club-registration`
  route was meant.
  - Gated by a new cookie, `club_registration_intro_seen=true`
    (`Path=/club-registration`, `SameSite=Lax`, `Max-Age` ≈ 1 year), set
    via a new `"use server"` action (`club-registration/introActions.ts`,
    same pattern as `setLocaleAction`) and read server-side in
    `club-registration/page.tsx` via `next/headers` `cookies()` — no
    `localStorage`, no new backend API, no `Club` model change.
  - No separate logo image asset exists anywhere in this project (the
    sitewide "logo" is `SiteHeader`'s plain text brand link) — the intro
    reuses the two existing textual brand constants from
    `src/config/brand.ts` (`BRAND.abbreviation`, `BRAND.name`) rather than
    inventing a logo graphic.
  - `messages/{en,vi}.json` gain one new key,
    `clubRegistration.intro.title` — the approved Vietnamese copy verbatim
    ("Cùng tranh đấu hướng thành công") plus its English translation.
  - Respects `prefers-reduced-motion: reduce` (CSS keyframes disabled via
    media query; the component's own duration shortens from ~2.2s to
    400ms via a matching `matchMedia` check) — form still reveals without
    forced animation.
  - **Verified**: `tsc --noEmit` clean; `npm run lint` — 0 errors, same 1
    pre-existing unrelated warning; `npm test` — 47 suites / 184 tests
    pass (11 new tests across `RegistrationIntro`, `RegistrationIntroGate`,
    `introActions`, and `ClubRegistrationPage`'s two cookie-state
    branches); production build succeeds, including `/club-registration`
    — the previously-documented pre-existing upstream Next.js
    `/_global-error` prerender failure did not reproduce during this
    check (not caused by this change; not investigated further, out of
    scope for a UX addendum). Live-verified through the project's running
    Docker dev container: first visit shows the intro (not the form
    heading) in both EN and VI; a set intro cookie shows the form heading
    immediately in both EN and VI; `/clubs` (Directory) unaffected.
  - **Not built / unchanged**: `RegistrationForm`,
    `club-registration/actions.ts`, `clubsService.registerClub`, the
    `Club` model/serializer/API, RBAC, file upload rules, `OQ-011`/
    `OQ-012`/`OQ-013` — none touched.
  - **Not verified**: rendered-in-browser animation/mobile-viewport check
    — no Playwright/browser-automation tooling in this project or session
    (same standing gap as every prior Sprint's frontend work).

- **Sprint 4 — Tournament Structure** (`.ai/lld/tournaments.md`,
  authored and reviewed before this batch began, marked
  `TOURNAMENTS_LLD_READY`): REQ-TOURN-001 (schedule)/004 (archives).
  - **Backend — two new Django apps**, matching `ARCHITECTURE.md` §5's
    app split exactly: `tournaments` (`Tournament.name`; `Season.year`,
    unique, `Meta.ordering = ["-year"]`, FK to `Tournament`) and
    `matches` (`Match.season`/`home_club`/`away_club` FKs,
    `scheduled_at` `DateTimeField`, optional `venue`, `status`
    choice field defaulting to `scheduled`, `Meta.ordering =
    ["scheduled_at"]`). Only `ARCHITECTURE.md` §6's confirmed field set
    was implemented — no score/result field (`OQ-005`, untouched), no
    "current season" flag (checked, not invented —
    `.ai/lld/tournaments.md` §4). `GET /api/seasons/`
    (`SeasonListView`) and `GET /api/matches/` (`MatchListView`), both
    public (`AllowAny`, already the project default), list-only, no
    detail/write endpoint (no requirement describes one).
    `ClubMatchSerializer` (new, in `clubs/serializers.py`, id/name/logo
    only) is nested into `MatchSerializer` for the cross-app
    home/away-club shape — same pattern `players.serializers` already
    established in reverse.
  - **Known, explicitly-flagged gap**: `ClubMatchSerializer` does not
    filter by `Club.objects.approved()` the way Directory/Profile do —
    `BR-001` is scoped to "a club's profile information," not match-
    schedule participation, and matches are admin-only to create (no
    public write endpoint), so this is a real but low-probability gap,
    not a silently-assumed one. A passing test
    (`matches/tests/test_views.py::test_includes_matches_regardless_of_club_approval_status`)
    documents the current behavior explicitly.
  - **Frontend**: `ScheduleTable`/`ArchivesList`
    (`components/features/tournaments/`, the exact names
    `ARCHITECTURE.md` §4 reserves) replace `app/tournaments/page.tsx`'s
    Sprint-0 `PagePlaceholder`. `ScheduleTable`'s DOM is a card list, not
    a literal `<table>` — same naming-vs-markup gap already accepted for
    `ClubDirectoryList`. Both sections self-fetch/self-handle
    empty/error state independently (`ArticleList`/`HotNewsList`'s
    pattern, not `ClubsPage`'s shared-fetch pattern — corrected during
    implementation once it was clear Schedule and Archives share no
    data). New `tournamentsService.ts`/`types/tournament.ts`, real
    network calls to Django (no fixtures, matching every service built
    since Sprint 2). Match status renders as visible translated text
    (never color alone) with a secondary color-coded pill. Reuses the
    visual-direction refactor's `section-heading`/`empty-state-text`/
    `responsive-grid` mixins and the `Card`/`ErrorMessage` primitives —
    no new design-system work, per this batch's own instruction not to
    perform another global refactor.
  - **REQ-TOURN-002/003 not built, not even as a shell**: `StandingsTable`/
    `StatsLeaderboard` (also `ARCHITECTURE.md` §4-reserved names) were
    deliberately left unbuilt — an empty shell for `BLOCKED` scope is
    work this batch wasn't asked to do, same reasoning Batch 2 already
    applied to not creating empty RBAC groups.
  - **Verified**: `python manage.py check` — 0 issues; `makemigrations
    --check --dry-run` — zero drift; both new migrations inspected
    directly (`CreateModel` only, nothing destructive, `clubs`/`players`
    untouched); 24 new backend tests (Tournament/Season/Match model
    validation, cascade deletes, ordering; both endpoints' public
    access, ordering, response shape, empty state, and the
    approval-gap documentation test) — 83/83 backend tests pass.
    `tsc --noEmit` clean; `eslint` — 0 errors, same 1 pre-existing
    unrelated warning; 15 new frontend tests (service URL/error
    handling, both components' heading/empty/error/data-rendering
    cases) — 51 suites / 208 frontend tests pass, `routes.test.tsx`
    unmodified and still passing (the real Tournaments page gracefully
    falls back to each section's own `ErrorMessage` when `fetch` isn't
    mocked, rather than crashing the smoke test). Production build
    succeeds. **Live end-to-end verification through Docker** (seeded,
    then removed, a temporary tournament/3 seasons/3 clubs/3 matches —
    same no-permanent-seed-data precedent as every prior batch):
    `GET /api/matches/` correctly ordered ascending by `scheduled_at`;
    `GET /api/seasons/` correctly ordered descending by `year`;
    `/tournaments` renders real team names, translated status labels,
    and season labels correctly in both EN and VI; with seed data
    removed, both sections' real (not simulated) empty states render;
    all 7 real pages still return 200 in both locales; the Club Profile
    404-for-unapproved/nonexistent regression still holds.
  - **Not built** (explicitly out of scope, none confirmed by any
    requirement): live scoring, standings, player statistics, any
    external score API/data provider, a "current tournament" selection
    mechanism, a per-season or per-match detail page, pagination.
  - **OQ dependencies**: `OQ-005`/`OQ-007` (block REQ-TOURN-002 only —
    untouched), `OQ-008` (blocks REQ-TOURN-003 only — untouched). No OQ
    was resolved.

- **Post-Sprint-4 — Hero video carousel** (`REQ-HOME-001`'s video slice,
  gated by `OQ-003` at the time; direct stakeholder direction confirmed
  video as the answer during this batch, later formalized in the
  workbook `CHANGE_LOG` v1.1, 2026-08-18 — see below): `REQ-HOME-002`
  (tagline) unaffected, unchanged.
  - **`src/config/heroSlides.ts`** (new) — data-driven slide config, 4
    entries, each documenting exactly which real, licensed clip belongs
    at its path (`team-huddle`, `training-drill`, `dribbling`,
    `celebration`). **No video file exists at any of these paths** — this
    environment has no outbound binary-fetch capability and stock-
    footage licensing can't be verified unsupervised, so none was
    downloaded, and none was faked (no renamed files). Dropping a real
    file at any path activates that slide automatically, no code change
    needed.
  - **`HeroCarousel`** (new Client Component, `components/features/home/HeroCarousel/`)
    — owns all interactivity: `useSyncExternalStore`-backed
    `prefers-reduced-motion` detection (not effect+setState, per the
    stricter `react-hooks/set-state-in-effect` lint rule caught during
    this batch), timer-driven auto-advance (~7s/slide, fully disabled
    under reduced motion), crossfade transition, Prev/Next buttons,
    `role="tablist"`/`role="tab"` indicators with a segmented fill bar
    (state conveyed by fill-length + `aria-selected`, never color
    alone), a numeral counter, and per-slide video-error fallback to the
    existing real hero photo (`BRAND_ASSETS.hero`, from the earlier
    visual-assets batch) via its own `alt` text.
  - **`HeroSection`** reduced to a thin async Server Component: resolves
    every i18n string server-side (functions/closures can't cross the
    Server→Client boundary as props), passes plain serializable values
    to `HeroCarousel`.
  - **Copy discipline**: headline/eyebrow/description are identical
    across every slide by design (existing `BRAND.tagline`/
    `BRAND.abbreviation`/`home.mission.body`) — only the background
    video differs per slide. No new product claims were invented to
    make the "data-driven slides" structure real (`RULES.md` R006). Only
    new copy: UI chrome (CTA label, control `aria-label`s), same
    category as prior minimal i18n additions.
  - **Verified at the time**: `tsc`/`eslint` (including the
    `set-state-in-effect` fix)/`jest` (51 suites/208 tests then)/`next
    build` all clean; live via Docker — video paths genuinely 404
    (proving the fallback path is real, not simulated), correctly
    localized EN/VI, all routes unaffected.
  - **Re-verified during the Sprint 5 pass below** — still fully intact,
    no regressions from any later batch's changes.
  - **OQ-003 status at implementation time**: session-level stakeholder
    confirmation only, workbook not yet updated — see the Sprint 5 entry
    below for the formal `CHANGE_LOG`/`OPEN_QUESTIONS`/`REQUIREMENTS`
    closure that followed.

- **Sprint 5 — Header regression fix + full QA pass** (`SPRINT_PLAN.md`'s
  Sprint 5 scope: "no new requirement-level tasks... full regression/
  accessibility/responsive verification... re-run the Open Question
  check"):
  - **Header regression, root-caused and fixed**: switching EN→VI could
    visibly push/break `SiteHeader`. Root cause: `.navLink` had no
    `flex-shrink: 0` inside the flex-wrap nav container, so when three
    flex siblings (brand/nav/language-switcher) competed for one row,
    `.nav` could be squeezed to a footprint smaller than its own
    content — its individual link labels then shrank and wrapped
    *mid-phrase* instead of whole items moving to a new line.
    Vietnamese's longer, uppercase-transformed labels triggered this far
    more visibly than English's shorter ones, but the bug was
    locale-agnostic. An earlier attempted fix used a fixed 1200px
    viewport breakpoint (plus a `maxWidth: "1400px"` inline override on
    the header's `Container`) to force nav onto its own row below that
    width — this was itself a regression: 1200-1400px isn't reliably
    wide enough for all 8 VI labels to fit inline, so the squeeze could
    still occur right at that boundary, and the widened Container
    misaligned the header from every other page's standard 1200px
    content width. **Final fix**: removed the viewport-breakpoint guess
    and the Container override entirely. `.brand`/`.actions`/`.nav` all
    get `flex-shrink: 0` (never compressed below natural content
    width); `.nav` additionally gets `flex-grow: 1` (expands to fill
    leftover space when it does share a row). With all three top-level
    items refusing to shrink, `.inner`'s own `flex-wrap: wrap` is the
    *only* way insufficient width can be resolved — moving the whole
    nav block to its own line, driven by the browser's real-time
    measurement of actual rendered content at any viewport width or
    locale, not a guessed pixel number. `.navLink` also gained
    `white-space: nowrap` so a single label's own text never breaks
    mid-phrase (the container-level wrap handles "doesn't fit" instead).
  - **Verified**: compiled CSS inspected directly through the running
    Docker container — `.nav` correctly compiles to
    `flex: 1 0 auto; order: 3;` with no media query, and the header's
    `Container` correctly resolves back to the sitewide standard
    `max-width: 1200px`. Both locales confirmed live: all 8 nav items
    render with full untruncated text in EN and VI. `tsc`/`eslint`/
    `jest` (51 suites / 208 tests)/`next build` all clean.
  - **Full Sprint 1-4 regression, verified live through Docker** (seeded,
    then removed, a temporary approved club with roster/coaching-staff/
    achievements/contact-info, plus a tournament/2 seasons/2 clubs/1
    match — same no-permanent-seed-data precedent as every prior batch):
    Home, About, News, Gallery, Contact, Club Directory, Club Profile,
    Club Registration, and Tournaments all return 200 in both EN and VI
    with correct headings and real seeded content (roster names, coach
    names, achievements text, contact info, match team names/venue/
    status, season labels) rendering correctly and correctly translated
    in VI; Club Profile's 404-for-unapproved/nonexistent regression
    still holds; the registration intro's first-visit/returning-visit
    gating still holds (`/club-registration` shows the intro on first
    visit, the real form `<h1>` once the intro-seen cookie is set); a
    real multipart `POST /api/clubs/` still succeeds end-to-end.
  - **Accessibility, code-level audit** (no browser-automation tooling in
    this project/session, same standing gap noted throughout every prior
    Sprint): every `<img>`/`next/image` usage sitewide confirmed to carry
    an `alt` attribute (meaningful text or deliberate `alt=""` for
    decorative images); `focus-ring` mixin confirmed applied across 12
    component stylesheets; `role="alert"` confirmed on both
    `ErrorMessage` and `FormField`'s inline field-error text; the Hero
    carousel's Prev/Next/indicator controls all confirmed to carry real
    `aria-label`s.
  - **Backend**: `manage.py check` — 0 issues; `makemigrations --check
    --dry-run` — zero drift; all 83 backend tests re-run individually
    (not just summarized) — 83/83 pass.
  - **Open Question re-check**: all 15 OQs (`OQ-001`-`OQ-015`) confirmed
    still `Open` directly against `REQUIREMENTS.md` — none silently
    resolved. One item flagged, not resolved here: `OQ-003` ("Home hero:
    banner, video, or both") has a session-level stakeholder
    confirmation toward "video" (already reflected in the Hero carousel
    implementation's own code comments/report), but the formal workbook
    `OPEN_QUESTIONS`/`CHANGE_LOG` entries were never updated — that's a
    stakeholder-facing bookkeeping step (`RULES.md` R014), not something
    to do unilaterally from this pass. No Post-Clarification Backlog
    item newly qualifies for promotion into a numbered Sprint.
  - **`OQ-003` subsequently closed** (2026-08-18, immediately after this
    Sprint 5 pass, on explicit stakeholder instruction): `Requirement_Analysis.xlsx`
    `OPEN_QUESTIONS` sheet Status → `Closed`, `REQUIREMENTS` sheet's
    `REQ-HOME-001` Status → `Draft - Awaiting Client Review` (the same
    convention every other OQ-free requirement already uses), and a new
    `CHANGE_LOG` v1.1 row records the decision, reason, date, and
    authorship. `REQUIREMENTS.md` updated to match. A backup of the
    workbook was taken before editing. `OQ-001`/`002`/`004`–`015` remain
    untouched, still `Open`.
  - **Not fully achievable in this environment, flagged rather than
    silently skipped**: literal rendered-in-browser verification at
    320/375/390/768/1024/1280/1440px, a cross-browser matrix, and formal
    UAT — no Playwright/browser-automation tooling exists in this
    project or session (the same standing gap documented in every prior
    Sprint's frontend work). The Header fix specifically was verified by
    (a) confirming the exact compiled CSS rules shipped correctly and
    (b) flexbox semantics analysis (`flex-shrink:0` + `flex-wrap` on a
    row is well-defined, capacity-driven browser behavior, not something
    that requires pixel measurement to reason about for this specific
    defect), not by visual/pixel inspection.

- **Sprint 6 — Contact Info display** (`.ai/lld/contact.md`, authored
  before this batch began, marked `CONTACT_INFO_LLD_READY`):
  `REQ-CONTACT-001`. Selected as the sole Sprint 6 task after
  systematically cross-checking every `READY`/`PARTIALLY_READY`
  requirement in `REQUIREMENTS.md` against `IMPLEMENTATION_STATUS.md` —
  everything else was already implemented; this one was in Sprint 1's
  original scope table but never actually built (the Contact page was
  still the raw Sprint-0 `PagePlaceholder`, with zero mention anywhere
  in this file until now).
  - **The real gap**: the source document names only the *categories* of
    contact info required (office address, hotline, support emails for
    professional-support/sponsorship-cooperation inquiries) — no actual
    address, phone number, or email value exists anywhere in
    `Requirement_Analysis.xlsx` or `Giai doan 1.docx`. Not invented
    (`RULES.md` R006) — built the real display structure backed by a
    `null` fixture, same precedent as `ChampionsCorner`/`PartnersSection`/
    every Gallery section.
  - **New**: `types/content.ts` gains `ContactInfo`
    (`officeAddress?`/`hotline?` as plain strings — not `LocalizedText`,
    same precedent as `Club.name`/`province_region`;
    `supportEmails?: Array<{label: LocalizedText, email: string}>` — the
    label is UI-authored categorization, the email itself is not
    per-locale). `services/fixtures/contactInfo.ts` (`CONTACT_INFO_FIXTURE = null`),
    `contentService.getContactInfo()`. `components/features/contact/ContactInfo`
    (the exact name `ARCHITECTURE.md` §4 reserves) — self-fetching async
    Server Component (own `try`/`catch`, empty/error state), rendering a
    `tel:` link for the hotline and `mailto:` links for support emails
    once real values exist. `app/contact/page.tsx` replaces the
    `PagePlaceholder`, keeping the existing page-level `<h1>`
    (`pages.contact.title`, unchanged) with `ContactInfo` as its own
    `<h2>` section below it — the majority sitewide pattern (Gallery/
    News/Tournaments/Clubs), not the one-off `BrandStory` exception.
  - **`REQ-CONTACT-002` (feedback form) untouched** — still `BLOCKED` on
    `OQ-014`, not built even as a shell (`ContactForm`, the other name
    `ARCHITECTURE.md` §4 reserves for this module, remains deliberately
    unbuilt — same posture as `StandingsTable`/`StatsLeaderboard`).
  - **Verified**: `tsc --noEmit` clean; `eslint` — 0 errors, same 1
    pre-existing unrelated warning; 4 new tests (heading, empty state,
    error state, and a populated-data case exercising the `tel:`/
    `mailto:` links and per-locale email labels) — 52 suites / 212
    frontend tests pass, `routes.test.tsx` unmodified and still passing
    (it only ever asserted the page's `<h1>` text, unchanged). Production
    build succeeds. Backend re-confirmed unaffected (83/83 tests,
    `manage.py check` clean — this batch is frontend-only, no model
    change). Live via Docker: `/contact` renders the real heading and
    empty-state text correctly in both EN and VI; full 8-route × 2-locale
    regression swept, all 200; Club Profile 404 regression intact.
  - **OQ dependencies**: none for `REQ-CONTACT-001` itself. `OQ-014`
    continues to block only `REQ-CONTACT-002`, untouched.

## In progress

*(none — Sprints 0-6 are complete for their scoped requirements, with
the pixel-level responsive/cross-browser/UAT caveat noted above.
REQ-GALLERY-001's video half remains an open gap in the
Post-Clarification Backlog, not an in-progress task. Every remaining
`READY`/`PARTIALLY_READY`-independent-slice requirement is now
implemented — further work is entirely Open-Question-gated Backlog
items, per the systematic check performed for Sprint 6.)*

## Blocked

- **Execution level**: production Next.js build (`npm run build`) fails —
  see the Docker section above. Tracked here as an open item, not
  silently fixed or hidden; does not block the currently-used `dev`
  Docker workflow or Sprint 1 development.
- **Requirement level**: 7 requirements BLOCKED, 5 PARTIALLY_READY, 2
  NEEDS_REVIEW — see `REQUIREMENTS.md`.

## Next task

**Implementation is paused pending stakeholder clarification.**
Sprints 0-6 are complete for their scoped requirements, and the Sprint
6 final readiness audit (2026-08-18) confirmed no currently-unblocked
requirement remains: every requirement in `REQUIREMENTS.md` not yet
implemented is either `BLOCKED` on a named, still-open OQ or
`NEEDS_REVIEW` for a named, real gap (REQ-GALLERY-001, REQ-GLOBAL-002) —
none reclassified to manufacture completeness. There is no next
implementation task to pick up without a stakeholder answer; the next
action on this project is external (an OQ answer or a new requirement/
Open Question raised for a NEEDS_REVIEW gap), not further unprompted
coding.

**Sprints 0-6 are complete for their scoped requirements.**
REQ-CLUB-001–006, REQ-REG-001/002/003, REQ-TOURN-001/004, and (as of
Sprint 6) REQ-CONTACT-001 are implemented (every non-OQ-gated,
independent slice recorded as `READY` or `PARTIALLY_READY` in
`REQUIREMENTS.md`); Sprint 5's regression/accessibility/OQ-recheck pass
is done, with the caveat that literal pixel-level responsive/
cross-browser/UAT verification isn't achievable in this environment (no
browser-automation tooling — flagged, not silently skipped).
`SPRINT_PLAN.md` has no further sprint defined beyond Sprint 6 —
remaining work lives entirely in the Post-Clarification Backlog, gated
by Open Questions. `OQ-011` (upload format/size validation) remains
open, gating only that slice of REQ-REG-003. `OQ-005`/`OQ-007`/`OQ-008`
remain open, gating REQ-TOURN-002/003 only — the Tournament data model
was designed with an additive extension point for a future score/result
relation (`.ai/lld/tournaments.md` §3), so resolving them later should
not require a structural rewrite. REQ-REG-004/005 stay untouched in the
Backlog (`OQ-012`/`OQ-013`). `OQ-003` is formally `Closed`
(`Requirement_Analysis.xlsx` `CHANGE_LOG` v1.1, 2026-08-18) — video
confirmed as the Home Hero format; `REQ-HOME-001` no longer carries a
pending decision. `OQ-014` remains open, gating REQ-CONTACT-002 (the
feedback form) only — REQ-CONTACT-001 (info display) required no OQ
resolution and is now implemented per `.ai/lld/contact.md`. Seed/test
data remains deliberately deferred/not-permanent (each sprint seeds and
removes temporary data for its own verification pass, same precedent as
every prior batch). REQ-GALLERY-001's video half stays an open,
unimplemented gap in the Backlog — raising it as a proposed Open
Question is a stakeholder-facing step, not something to do unilaterally
here. With this sweep, no further READY/PARTIALLY_READY-independent
work remains outside the Open-Question-gated Backlog.

## Unresolved Open Questions affecting implementation

14 of 15 (`OQ-001`/`002`/`004`–`015`) remain open. `OQ-003` was closed
2026-08-18 — a stakeholder-confirmed decision recorded in the workbook
`CHANGE_LOG` v1.1 (`RULES.md` R014); `REQ-HOME-001` no longer has a
pending format decision.

**Gating the rest of Sprint 1** (partial blocks only, core scope
unaffected): `OQ-006` (`REQ-ABOUT-002` final copy naming
specific standards — About's structure/generic-copy slice is unaffected).

**Affecting future sprints** (per `SPRINT_PLAN.md`'s OQ Blocking Matrix,
none touched by Sprint 1 work):
- `OQ-009`, `OQ-010` — Sprint 2, now fully executed (Batches 1–4):
  `OQ-009` still blocks only the Directory's map slice (unchanged since
  Batch 3); `OQ-010` still blocks only the approval *action* (unchanged
  since Batch 2) — the display gate itself is implemented and unblocked
  in both the Directory and the Profile.
- `OQ-011` — Sprint 3, now fully executed for its non-OQ-gated scope:
  blocks only the upload format/size *validation* slice of REQ-REG-003;
  the registration mechanism itself (fields, file storage) is
  implemented and unblocked.
- `OQ-012`, `OQ-013` — Club Dashboard auth; roster-update deadline.
  `REQ-REG-004`/`005` remain untouched, currently Backlog.
- `OQ-005`, `OQ-007`, `OQ-008` — Backlog, blocking Standings/Statistics;
  `OQ-005` is highest-leverage (gates 3 requirements at once).
- `OQ-004`, `OQ-005` — **Closed** (2026-08-20, stakeholder decisions recorded for REQ-HOME-005 Homepage Live & Results scoreboard).
- `OQ-001`, `OQ-014`, `OQ-015` — Backlog (domain/hosting; Contact form; the untestable "FIBA/NBA-quality" wording).

None of Sprint 0's or Sprint 1's actual work depended on any of these.

## How to update this file

After each Sprint or meaningful implementation step: move finished items
into **Completed**, update **In progress**/**Blocked**, and set **Next
task** to the next actionable item per `SPRINT_PLAN.md`'s execution
order. Don't copy Sprint scope details back into this file — link to
`SPRINT_PLAN.md` instead. Don't claim a feature is implemented unless it
actually exists and is verified in the codebase.
