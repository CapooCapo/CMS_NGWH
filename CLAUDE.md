# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

NextGen Women Hoops (NGWH) — a bilingual (EN/VI) public site for a U20 women's
basketball league in Vietnam, plus a staff admin area. Two sibling projects,
**each its own git repo** (the root directory is not a repo):

- `web/` — Next.js 16 App Router app (React 19, Tailwind v4, next-intl). Public site + admin + JSON API.
- `studio/` — Sanity Studio v6 (project `7o3rvpf2`, dataset `production`), the CMS for editorial content.
- `.ai/` — planning docs. `REQUIREMENTS.md` (the `REQ-*` / `OQ-*` / `BR-*` IDs cited throughout the code) and `DESIGN_SYSTEM.md` are the live references. See "Stale planning docs" below.

## Two data stores — the central architectural fact

Content is split by *kind*, and the split is deliberate:
2
| | Store | Examples |
|---|---|---|
| **Editorial content** | Sanity | news, gallery, home/about/contact page copy, partners |
| **Transactional data** | PostgreSQL | clubs, club registrations + uploaded documents, seasons, matches, scores, player stats, contact messages, staff accounts and sessions |

Never put a registration, score or staff account in Sanity, and never put page
copy in Postgres. Public pages routinely read both in one render.

## Commands

Postgres runs in Docker (port **5433**, since 5432 is usually already taken). From the repo root:

```bash
docker compose up -d          # needs POSTGRES_PASSWORD in the shell/env
```

From `web/`:
```bash
npm run dev            # localhost:3000
npm run build
npm run lint           # eslint (flat config)
npx tsc --noEmit       # typecheck
npm run db:migrate     # apply src/server/migrations/*.sql
npm run admin:create -- --username admin --role superadmin
npm run owner:create -- --email owner@club.example --club <club-slug>   # Club Owner account (admin path)
npm run db:seed-demo   # idempotent `demo-*` seasons/clubs/matches/stats + 2 demo Club Owners
npm test
```

From `studio/`:
```bash
npm run dev            # Studio on localhost:3333
npm run build
npm run deploy
npm run typegen        # see below — regenerates web/sanity.types.ts
npx eslint .           # no lint script defined
```

## Tests

`node --test` (Node's built-in runner) over `web/tests/*.test.ts` — no Jest, no
Vitest. `tests/resolve-hook.mjs` teaches Node's ESM resolver the `@/*` alias and
extensionless relative imports so the runner can load `src/` directly; TypeScript
is handled by Node's native type stripping, which is why source files avoid
constructs it can't strip (e.g. `ValidationError` assigns `errors` explicitly
instead of using a parameter property).

Run one file, or one test:
```bash
node --test --env-file-if-exists=.env.local --conditions=react-server \
  --import ./tests/resolve-hook.mjs tests/permissions.test.ts
# add --test-name-pattern "last superadmin" for a single case
```

Three tiers, and **each self-skips when its dependency is absent, so `npm test`
passes green with nothing running** — check the skip notices, not just the exit code:

- **Pure** (`permissions`, `validate`, `password`, `registration-validation`) — no I/O, always run.
- **DB-backed** (`standings`, `bootstrap`) — need a migrated database. They create uniquely-slugged fixtures (`test-*-$PID`) and delete them afterwards, so they never touch real rows.
- **Live-server** (`api-authorization`, `superadmin-authorization`, `owner-workflow`, `registration-workflow`) — probe `BASE_URL` (default `http://localhost:3000`) and skip entirely if unreachable. They assert the HTTP surface enforces roles from the *session*, whatever the body claims, so they also need accounts: `api-authorization` skips its authenticated cases without `TEST_ADMIN_PASSWORD`, and `superadmin-authorization` needs three fixture accounts whose `npm run admin:create` invocations are listed in its header comment. `owner-workflow` and `registration-workflow` reuse the `biz-admin` account from that set and then build their own disposable accounts, clubs and registrations through the real HTTP API, so they need no separate owner fixture.

## The typegen contract between studio and webz

`studio/sanity.cli.ts` points typegen **across the directory boundary**: it
extracts the schema to `studio/schema.json`, scans GROQ in `web/src/**/*.{ts,tsx}`,
and writes `web/sanity.types.ts`.

- Run `npm run typegen` **from `studio/`** after changing either a schema in `studio/schemaTypes/` or a query in `web/src/sanity/queries.ts`. Editing only `web/` still requires running it from `studio/`.
- `overloadClientMethods: true` types `client.fetch(QUERY, params)` automatically — but only for queries declared with `defineQuery()` in `web/src/sanity/queries.ts`. Inline query strings get no types; always add queries there.
- `web/sanity.types.ts` is generated; never hand-edit it.

Postgres has no typegen: row shapes are hand-written in
`web/src/server/repositories/types.ts` and must be kept in step with the SQL
migrations by hand.

## Internationalization

Two locales, `en` and `vi` (`web/src/i18n/config.ts` and
`studio/src/structure/index.ts` each declare their own list — keep them in sync).

**No locale in the URL.** Locale lives in a `NEXT_LOCALE` cookie read by
`web/src/i18n/request.ts`; `setLocaleAction` (a server action) writes it and
calls `revalidatePath("/")`. Pages get it via `await getLocale()` and pass it as
the `$language` GROQ parameter — every content query filters `language == $language`.

UI chrome strings live in `web/messages/{en,vi}.json` (next-intl, ~270 lines
each, kept structurally identical); editorial copy comes from Sanity. Both
locales must be updated together.

Three localization strategies coexist, by store:
- **Sanity, plugin-managed** — `newsArticle` / `galleryItem` use `@sanity/document-internationalization` (`TRANSLATABLE_TYPES` in `studio/sanity.config.ts`); the `language` field is hidden.
- **Sanity, localized singletons** — `homePage` / `aboutPage` / `contactPage` are one document per locale at fixed IDs (`homePage-en`, `aboutPage-vi`, …), reachable only through the custom Structure. They are kept out of the "New document" menu by `SINGLETON_TYPES` filtering in both `newDocumentOptions` and the parameterized initial-value templates. Adding a singleton means adding it to `SINGLETON_TYPES` *and* to `structure`.
- **Postgres, paired columns** — no per-locale rows; bilingual fields are column pairs (`name_en`/`name_vi`, `achievements_en`/`achievements_vi`) picked at render time.

`partner` is the same idea in Sanity: it has no `language` field (one shared
document per organisation), so its role is `roleEn`/`roleVi`, resolved by
`ABOUT_PAGE_QUERY` via `coalesce(select($language == "vi" => roleVi), roleEn, role)`.
`role` is the pre-bilingual field, kept read-only as a fallback.

## Content model (Sanity)

`homePage`, `aboutPage`, `contactPage` (localized singletons; `aboutPage`
references `partner`), `newsArticle`, `galleryItem`, `partner`, and
`blockContent` (the shared Portable Text array).

Category *values* are enums fixed in the schema; their human labels live in
`web/src/sanity/queries.ts` (`NEWS_CATEGORY_LABELS`, `GALLERY_CATEGORY_LABELS`)
keyed by locale, read through `newsCategoryLabel(locale, value)` /
`galleryCategoryLabel(locale, value)`. Changing a category means editing the
schema `options.list` **and every locale** in the label map.

All `blockContent` renders through `web/src/components/PortableTextBody.tsx`,
which owns the shared styling for paragraphs, headings, lists, links and marks —
use it, not a bare `<PortableText>`.

## Server layer (`web/src/server/`)

A real layered backend, all marked `import "server-only"` except `auth/permissions.ts`
and `auth/cookie.ts` (see below):

- `db/pool.ts` — the single `pg` pool, cached on `globalThis` so dev HMR doesn't leak one per reload. Exposes `query` / `queryOne` / `transaction`. **Always parameterized SQL**; never interpolate input.
- `migrations/*.sql` — forward-only, applied in filename order, each in its own transaction, recorded in `schema_migrations`. Add a new numbered file; never edit an applied one.
- `repositories/` — SQL only, one module per aggregate. Public read paths take an `approvedOnly` / `filter.approvedOnly` flag; a club profile is only public once `is_approved` (BR-001).
- `services/` — multi-write business logic (`registrationReview` approves inside one transaction with `SELECT … FOR UPDATE`; `standings` computes the table).
- `validation/` — hand-rolled `Validator` (no schema library, by project convention). Returns a flat `Record<field, code>` of *message keys*, so the client localizes; `readJson` treats a malformed body as a validation error.
- `api/respond.ts` — every route answers through `ok` / `notFound` / `badRequest` / `fail`. `fail` maps `ValidationError` → 400 with field codes, Postgres SQLSTATEs (unique/FK/check/not-null) → 409/400, and anything else to a logged, opaque 500. Internal error text never reaches the client.

## Auth and authorization

Read `web/src/middleware.ts`'s comment before touching any of this.

**Middleware is not the security boundary.** It only checks that a session
cookie is *present* on `/admin/*` and redirects to `/admin/login` otherwise —
the Edge runtime cannot load `pg` or `node:crypto`, so it cannot validate
anything. That is why `SESSION_COOKIE` lives in the dependency-free
`auth/cookie.ts`: importing it from `auth/session.ts` would drag Node-only deps
into Edge and turn every `/admin` request into a 500.

Real enforcement happens twice, and both are required:
- every `/api/admin/*` handler calls `requireRole()` / `requireViewer()` / `requireUserAdmin()` / `requireSuperadmin()` from `auth/guard.ts` (401 unauthenticated, 403 wrong role, no leak of whether the resource exists);
- `src/app/admin/(protected)/layout.tsx` resolves the session against the database via `currentAdmin()` and redirects when it is null, so a forged, expired or deactivated session renders nothing.

The `(protected)` route group exists precisely so that guard does **not** wrap
`/admin/login`: Next layouts nest rather than override, so an `app/admin/layout.tsx`
would guard the login page too and redirect it to itself forever. The group keeps
URLs unchanged (`/admin/dashboard`, …) while leaving login outside the guard — add
new authenticated pages inside it, and anything unauthenticated outside it.

`auth/permissions.ts` is deliberately dependency-free (no `server-only`, no DB,
no `next/*`) so the rules are unit-testable *and* the admin UI can import the
same predicates. **UI use is presentation only** — every decision is re-made
server-side. Roles: `superadmin` > `admin` > (`editor`, `operator` — parallel,
not ranked) > `subadmin` (read-only). `ROLE_RANK` governs *account management*
only, not capability; per-endpoint capability stays in the explicit guards.
Invariants encoded there: only a superadmin may assign superadmin, nobody may
act on an account outranking them, no self-deactivation, and the last active
superadmin cannot be demoted (`superadminCount` is read in the same transaction).

Sessions are **rows, not JWTs**, specifically so deactivating an account logs it
out immediately: a 256-bit opaque token in an httpOnly cookie, stored only as
its SHA-256 digest, 12h TTL. Passwords use `node:crypto` scrypt with parameters
embedded in the hash string (no bcrypt/argon2 native dep). `scripts/create-admin.mjs`
is the only bootstrap path — it reads the password from the environment or an
echo-disabled prompt, never from argv (visible in `ps`).

### Club Owners — the second principal kind

Staff are not the only accounts. A **Club Owner** signs in at `/login` (public
site, not `/admin/login`) and manages exactly one club at `/my-club`. It is a
deliberately *separate* identity space, not a new `admin_users` role:
`club_owners` / `club_owner_sessions` (migration 005), the
`ngwh_owner_session` cookie in the dependency-free `auth/ownerCookie.ts`, and
`auth/ownerGuard.ts` — each mirroring its staff counterpart so the well-tested
staff RBAC invariants in `permissions.ts` stay untouched. Same scrypt hashes,
same opaque digest-stored session rows, same 12h TTL.

Ownership is the whole authorization model, and it is **never read from the
request**: `requireOwnedClub()` resolves "which club does this session own"
from `clubs.owner_id`, so `/api/owner/*` has no club id to tamper with. Roster
and document lookups filter by `club_id` in the same SQL statement, so another
club's member or document id resolves to 404 rather than a cross-club write.
An owner may not edit `slug` or `is_approved` — `validation/ownerClub.ts` does
not accept them and the route re-merges the stored values, so self-publishing
is impossible, not merely discouraged.

### The club-registration workflow

`club_owners` doubles as the **general account table**: a person signs up at
`/signup`, and owning a club is a nullable link from the club side
(`clubs.owner_id`), not a property of the account. That is what makes a public
sign-up safe — a new account grants nothing, and there is no field in the
signup request that could ask for a club or a role.

    /signup → /login → /clubs/register → PENDING → admin approves
            → clubs.owner_id = the registrant, + a head-coach club_members row
            → /my-club

`POST /api/registrations` is **authenticated** (migration 006): approval turns
the submitter into the club's owner and head coach, so intake needs a known
account. Identity comes from `currentOwner()`; `parseRegistration` never reads
an owner/user id from the multipart body, so no `ownerId` field can attribute
a registration to someone else. The page's signed-out state is a courtesy —
the route's 401 is the boundary.

`approveRegistration` does club row + ownership + head coach + registration
stamp in **one transaction**, and is idempotent: re-approving updates the
existing head coach rather than adding a second (a partial unique index on
`club_members (club_id) WHERE is_head_coach` would reject one anyway). It
never steals a club that already has a different owner.

Head coach is a **flag on the existing coach role**, not a fourth
`member_role` — that keeps the `player|coach|staff` CHECK and every UI switch
over it untouched. `club_members.club_owner_id` links the row to the account,
which is why that row is protected: deleting it (409, both owner and admin
routes) would drop the guaranteed "HLV trưởng" with no way to recreate the
link. Staff release it by unassigning the owner, which calls
`clearClubHeadCoach`.

`resolveOwnerWorkspace()` (`services/ownerWorkspace.ts`) is the single source
of "where is this person in the workflow" — anonymous / noRegistration /
pending / rejected / approved. The navigation, `/clubs/register` and
`/my-club` all read it, which is what stops them disagreeing.

Accounts can also still be created and linked by an admin (the "Club Owner
account" panel on `/admin/clubs`, `POST /api/admin/clubs/[id]/owner`) or by
`scripts/create-club-owner.mjs` — used for clubs that never went through
self-service registration.

## Frontend conventions

- Pages are async Server Components fetching directly — `client.fetch(QUERY, params, options)` for Sanity with a shared `const options = { next: { revalidate: 30 } }` per file; repository calls for Postgres. There is no data-access abstraction over Sanity.
- **Routing**: `src/app/(site)/` is the public site (`/`, `/news`, `/news/[slug]`, `/about`, `/gallery`, `/clubs`, `/clubs/[slug]`, `/clubs/register`, `/tournaments`, `/tournaments/[slug]`, `/live`, `/contact`); `src/app/admin/` is the staff area with a `(protected)` group; `src/app/api/` is the JSON API. `(site)/[slug]` is **not** an article route any more — it is a legacy 308 redirect to `/news/<slug>` and must stay a leaf that only matches real article slugs.
- Live scores are **polled JSON**, not SSE — `/api/live` is public, `Cache-Control: no-store`; `/live` is `force-dynamic`. Operators post scores to `/api/admin/matches/[id]/score`, which can only change score/status/period, never the fixture.
- Shared UI primitives live in `src/components/ui/index.tsx` (`Container`, `PageHeader`, `Button`/`ButtonLink`, `Card`, `Badge`, `Table`/`Th`/`Td`, `Field`, `EmptyState`, `Skeleton`, `controlClass`, …). Compose these rather than re-styling from scratch.
- Styling is Tailwind v4 through the design tokens in `src/app/globals.css` — never raw hex. `.ai/DESIGN_SYSTEM.md` is the live spec and records what the previous pass got wrong (one card for everything, accent-rail headings, three near-identical reds); read it before visual work. `--live` means a match in progress and nothing else.
- Gallery pagination is in-memory after fetching all items, with three independent page params (`hogPage`, `mvpPage`, `btsPage`) on one route.
- Images: build Sanity URLs through `urlForImage()` (`src/sanity/image.ts`); `cdn.sanity.io` is the only host allowed in `next.config.ts`.

## Next.js 16 specifics

`web/AGENTS.md` (auto-generated and re-added by `next dev`; `web/CLAUDE.md` just
`@`-imports it) instructs reading `web/node_modules/next/dist/docs/` before
writing App Router code, since conventions differ from older versions. Notably
this codebase uses the generated route-typed globals (`LayoutProps<"/">`,
`PageProps<"/gallery">`, `PageProps<"/[slug]">`) rather than hand-written prop
types, and `params`/`searchParams` are Promises that must be awaited.

## Studio one-off scripts

`studio/scripts/_*.mjs` are ad-hoc content migrations run with
`npx sanity exec scripts/<file>.mjs --with-user-token`. They use `getCliClient()`
and **write directly to the production dataset** — read one before running it,
and note `_migrate-about.mjs` reads images from a hardcoded absolute temp path
that no longer exists.

## Configuration

`web/.env.local` (git-ignored) holds `NEXT_PUBLIC_SANITY_PROJECT_ID`,
`NEXT_PUBLIC_SANITY_DATASET` and `DATABASE_URL`. There is **no `.env.example`**
in the repo despite `db/pool.ts`'s error message pointing at one. The Studio
hardcodes the same project/dataset in `sanity.cli.ts` and `sanity.config.ts` —
change all four places together.

## Stale planning docs

`.ai/ARCHITECTURE.md` and `.ai/IMPLEMENTATION_STATUS.md` are **partly** stale and
must not be trusted on specifics. They correctly anticipate the shape now in
place (Next.js API handlers, `src/server/repositories/`, PostgreSQL, an admin
system with RBAC), but describe an implementation that does not exist:

- SCSS Modules → actually Tailwind v4
- Jest / React Testing Library, "185 tests" → actually `node --test`, 8 files
- HMAC session tokens, PBKDF2 with a static salt, `adminAuth.ts`, `schemaInit.ts` runtime bootstrap → actually opaque DB-backed sessions, per-hash scrypt salts, `auth/session.ts`, and `scripts/create-admin.mjs`
- `.ai/lld/admin.md`, `hero_slides` table, `src/config/heroSlides.ts`, `/admin/players`, `/admin/news`, `/admin/gallery`, `/admin/homepage/hero` → none exist
- a Django predecessor and a `frontend/` directory → never present in this codebase

Verify against source before acting on either file. `.ai/REQUIREMENTS.md`
(`REQ-*`, `OQ-*`, `BR-*`) is current and is cited by both Sanity field
descriptions and server-side comments; several `OQ-*` are still Open and the
code marks where an answer would change behaviour.
