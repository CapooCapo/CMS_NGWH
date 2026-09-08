# Architecture

*(Consolidates the former `TECH_STACK.md`, `HLD.md`, and
`DOCKER_ARCHITECTURE.md` — those files are removed; everything they
contained is here, reorganized to avoid repeating the same "purpose/scope"
framing three times.)*

## Purpose

The stable technology and architecture baseline for NextGen Women Hoops —
decides *how* the system is built (stack, components, boundaries, Docker
layout). It never decides unresolved business requirements; those stay
tracked as Open Questions (`REQUIREMENTS.md`).

## Scope

Technology stack + rationale, architecture style decision, system
components, frontend structure, backend module structure, database
architecture, authentication/RBAC boundary, live-score architecture,
Docker architecture, and the hard constraints binding all of it. Requirement
text and status live in `REQUIREMENTS.md`; Sprint execution lives in
`SPRINT_PLAN.md`.

---

## 1. Technology stack

No code, framework, or dependency file exists in the repository — this was
a greenfield decision evaluated against the 37 requirements in
`REQUIREMENTS.md`, not against any pre-existing code.

| Layer | Choice | Reason |
|---|---|---|
| Frontend framework | **Next.js** | The public site (Home, About, Tournaments, Gallery, Clubs, News, Contact) is content- and SEO-relevant; SSR/SSG fits better than a client-only SPA. Gives one conventional place to implement `REQ-GLOBAL-001` (i18n routing). |
| UI | **React** | Required by Next.js. |
| Language | **TypeScript** | Full-stack TypeScript across client components, Server Components, services, repositories, and API route handlers. |
| Styling | **Sass/SCSS**, component-local **SCSS Modules** | SCSS Modules for clean, scoped styling. |
| Full-Stack Backend | **Next.js App Router API Handlers** | Consolidated backend implementation inside Next.js using server services and direct PostgreSQL queries via `pg`. Preserves exact API semantics and Django database schema. |
| Database | **PostgreSQL** | Core entities (Tournament/Season/Match/Club/Player/Standing/Statistic) are relational with real FK structure and need transactional integrity (e.g. approval state gating profile visibility). |
| Containerization | **Docker** + **Docker Compose** | Parity environment with Next.js frontend container and PostgreSQL database container. |
| Testing | **Jest / React Testing Library** | Unit testing across frontend components, server services, and validation modules. |
| API style | **REST + JSON** | Preserves exact DRF REST endpoints and response structures. |

**Rejections/replacements**: none. Every proposed technology survived
evaluation against actual requirements — no requirement, Open Question, or
project rule argues for a different stack. `RULES.md` R016 fixes this
stack; changing it requires explicit re-approval.

---

## 2. Architecture style

| Criterion | Modular Monolith | Microservices | Traditional Monolith |
|---|---|---|---|
| Scope fit | 37 requirements, ~9 domains, single product/team implied | No requirement demonstrates independently-scaling services | Fits scope, no domain isolation |
| Deployment complexity | Low — one frontend, one backend | High, for zero confirmed benefit | Low, at the cost of maintainability |
| Maintainability | High — Django-app-per-domain boundaries without operational overhead | High in theory, unproven payoff here | Degrades as domains accumulate |
| Auth/RBAC fit | Centralizes cleanly with "backend is the authorization boundary" | Would need a separate/duplicated auth service — unjustified while `OQ-012` is still open | Centralized, same regression risk |
| Future extensibility | Domain boundaries leave room to extract a service later if ever needed | Pays the cost immediately for a benefit not yet needed | Harder to extract later without existing internal boundaries |

**Decision: Modular Monolith.** No domain (tournaments, clubs, live
scores, stats) has an independent scaling/deployment/team-ownership
requirement. A non-modular monolith would under-serve the actual domain
count by inviting boundary erosion. This preserves the option to extract a
service later without paying that cost now. `RULES.md` R017 requires
architectural review before ever splitting this into microservices.

## 3. Component overview

```
Browser → Next.js (frontend, SSR/SSG + client interactivity)
        → REST/JSON, OpenAPI-described
        → Django + DRF (backend, Modular Monolith)
            apps: accounts · clubs · tournaments · matches · players
                  statistics · standings · content
            + Score/Match Data Service (adapter boundary, §8)
        → PostgreSQL
```

Frontend never talks to PostgreSQL directly. Each backend "app" is a
Django app (domain module) inside the one backend container — not a
separately-deployed service.

## 4. Frontend structure

### Routing (Next.js App Router)

```
app/
├── (public)/
│   ├── page.tsx                  Home — REQ-HOME-*
│   ├── about/page.tsx            About Us — REQ-ABOUT-*
│   ├── tournaments/
│   │   ├── page.tsx              Schedule/Standings/Stats — REQ-TOURN-*
│   │   └── archives/page.tsx     Archives — REQ-TOURN-004
│   ├── gallery/page.tsx          Gallery/Hall of Fame — REQ-GALLERY-*
│   ├── clubs/
│   │   ├── page.tsx              Club Directory — REQ-CLUB-001/002
│   │   └── [clubId]/page.tsx     Club Profile — REQ-CLUB-003/004/005/006
│   ├── news/page.tsx             News & Media — REQ-NEWS-*
│   └── contact/page.tsx          Contact — REQ-CONTACT-*
├── club-registration/page.tsx    Club Registration — REQ-REG-001/002/003
├── club-dashboard/                Club Dashboard — REQ-REG-004/005
│   └── (reserved route — BLOCKED on OQ-012, not built)
└── layout.tsx                     Global layout, language switcher (REQ-GLOBAL-001)
```

No `app/api/` business routes — Next.js does not host business logic or
duplicate the Django API (constraint §12.2 / `RULES.md` R019). Any route
handler that exists should be a thin proxy (e.g. image optimization), not
domain logic.

### Components

```
components/
├── ui/            Reusable, generic: Button, Input, Label, FormField,
│                   ErrorMessage, LoadingSpinner, Card, Modal, Badge,
│                   Pagination — no domain knowledge.
├── features/
│   ├── home/       HeroSection, MissionOverview, HotNewsList,
│   │               LiveResultsSection (shell — REQ-HOME-005 BLOCKED),
│   │               ChampionsCorner
│   ├── about/       BrandStory, TournamentSystemSection, PartnersSection
│   ├── tournaments/ ScheduleTable, ArchivesList,
│   │               StandingsTable/StatsLeaderboard (shells — BLOCKED)
│   ├── gallery/     MediaAlbum, MVPSpotlightCard, BehindScenesEssay
│   ├── clubs/       ClubDirectoryList, ClubDirectoryFilter, ClubProfileCard
│   ├── registration/ RegistrationForm, FileUploadField
│   ├── news/        ArticleList, ArticleDetail
│   └── contact/     ContactInfo, ContactForm (shell — BLOCKED on OQ-014)
├── services/        API client layer — the ONLY place calling the Django
│                    REST API (e.g. clubsService.ts). Components never
│                    call fetch() directly.
├── hooks/           useClubs, useTournamentSchedule, useLanguage, etc.
└── types/           TypeScript interfaces mirroring DRF serializers.
```

"Shell"/"BLOCKED" components render layout without real data until their
Open Question resolves.

### SCSS

```
styles/
├── globals.scss          Resets, base typography, design tokens
├── _variables.scss
├── _mixins.scss
└── (component).module.scss   Co-located per component
```

## 5. Backend module structure

Every module maps to a requirement; none is created because it "sounds
useful."

| Django app | Maps to | Status |
|---|---|---|
| `accounts` | REQ-REG-004/005 (Club Dashboard auth); RBAC boundary (§7) | Boundary defined; implementation BLOCKED on OQ-012/OQ-010 |
| `clubs` | REQ-CLUB-001..006, REQ-REG-001..003 | Data model + directory/profile READY/PARTIALLY_READY |
| `tournaments` | REQ-TOURN-001, REQ-TOURN-004 | READY |
| `matches` | Schedule (REQ-TOURN-001); future score data (REQ-HOME-005, BLOCKED); houses the Score/Match Data Service | Schedule READY; scores deferred |
| `players` | Roster (REQ-CLUB-005); future REQ-TOURN-003 | READY (roster); stats usage BLOCKED |
| `statistics` | REQ-TOURN-003 | BLOCKED (OQ-008 + data-source gap) |
| `standings` | REQ-TOURN-002 | BLOCKED (OQ-005, OQ-007) |
| `content` | REQ-NEWS-*, REQ-GALLERY-*, REQ-ABOUT-*, REQ-HOME-001/003/004/006, REQ-CONTACT-001 | READY (mostly) |
| ~~`notifications`~~ | *(none)* | **Not created** — no requirement, business rule, or Open Question establishes a notification feature anywhere in the workbook. Revisit only if one is introduced later. |

`GLOBAL-001` (i18n) is a cross-cutting Django/DRF + Next.js configuration
concern, not its own app. `GLOBAL-002` isn't buildable as written
(`OQ-015` — untestable) and has no module.

## 6. Database architecture

Entity relationships at HLD level — field lists are intentionally
incomplete where the underlying requirement/workflow is unresolved. Full
field-level schema is an LLD decision, made per-Sprint once each Open
Question resolves.

```
Tournament (1) ──── (N) Season
Season (1) ──── (N) Match
Season (1) ──── (N) Standing          [one row per Club per Season]
Season (1) ──── (N) Statistic         [one row per Player per Season per category]
Season (1) ──── (0..1) Champion       [FK to Club — REQ-HOME-006]
Club (1) ──── (N) Player              [Roster — REQ-CLUB-005]
Club (1) ──── (N) CoachStaff          [Coaching staff — REQ-CLUB-005]
Match (N) ──── (2) Club               [home_club, away_club]
```

- **Tournament**: the overall brand (singular, not repeated per year).
- **Season**: one yearly edition ("Mùa giải 2024, 2025" — `REQ-TOURN-004`).
  Confirmed field: label/year. Everything else deferred.
- **Club**: confirmed public fields (`REQ-CLUB-004`): name, logo, founding
  year, achievements. Confirmed (`REQ-CLUB-006`): contact info, social
  links. Confirmed (`REQ-CLUB-002`): province/region. An approval-state
  field is required by `BR-001`, but its exact shape and any workflow
  metadata (submitted_at, approved_by, approved_at) are **not finalized**
  — the approval workflow itself is unresolved (`OQ-010`).
- **Player** / **CoachStaff**: roster entries per `REQ-CLUB-005` — exact
  fields beyond "a roster exists" are not confirmed by any requirement;
  pending LLD.
- **Match**: schedule fields (season, home/away club, date, time, venue)
  confirmed by `REQ-TOURN-001`. Score fields **not finalized** — pending
  `OQ-005`. A `status` field (scheduled/completed/postponed) is a
  technical necessity independent of the score-source question.
- **Standing**, **Statistic**: confirmed to exist (`REQ-TOURN-002/003`);
  field-level shape and computation source pending `OQ-005`/`OQ-007`/`OQ-008`.
- **Content models** (`NewsArticle`, `GalleryAlbum`, `MVPSpotlight`,
  `BehindScenesStory`, `ContactSubmission`): fields follow their READY
  requirements, except `ContactSubmission` — pending `OQ-014`.
- **Hero Section**: Converted to static content driven by source-controlled files in `public/assets/hero/` and `src/config/heroSlides.ts`. Decoupled from dynamic database queries; dynamic Admin editing/upload routes are disabled and return 405. The `hero_slides` table is retained as legacy data without dynamic coupling.
- **accounts**: no fields beyond "an account exists and links to a Club"
  are confirmed — credential shape depends on `OQ-012`.

## 7. Authentication and authorization boundary

**Backend is the sole authorization boundary.** Django/DRF permission
classes enforce every access decision; Next.js may hide/show UI for UX but
never as the actual security check (`RULES.md` R020).

### RBAC — proposed roles, evaluated

The four roles named in planning input — **System Admin, Club Manager,
Content Editor, Guest** — do not appear anywhere in `Requirement_Analysis.xlsx`
or the client document. What's actually evidenced: an unnamed approver role
for club registrations (`OQ-010`) and "authenticated club accounts"
(`REQ-REG-004`, method unresolved via `OQ-012`). These four roles are
recorded as a **candidate RBAC shape for planning only** — build the
permission system generically (Django's group/permission system supports
this) without hardcoding these names into business logic. The real role
set comes from `OQ-010`.

### Explicitly unresolved (tracked, not decided)

- Club approval authority — `OQ-010`.
- Account creation *after* club approval (auto-created vs. self-registered
  credentials) — no Open Question covers this yet; a genuine gap, not
  invented an answer for.
- Role assignment mechanism — `OQ-010` (partially).
- Club Dashboard access method — `REQ-REG-004`, `OQ-012`.
- Authentication method — `OQ-012`. Google Login and passwordless are not
  mentioned anywhere in the source at all — not just unresolved, absent
  from scope.
- Notification after approval/rejection — no Open Question covers this.

## 8. Live-score architecture

**Score/Match Data Service**: an internal service-layer boundary inside
the `matches` app — a fixed interface (`get_live_matches()`,
`record_match_result(...)`, `get_standings(season)`) that Home's Live &
Results, `standings`, and `statistics` all call through. No caller reaches
a specific ingestion mechanism directly.

**No source is selected.** Manual staff input, an external API, a
referee-side system, and a future integration all remain open pending
`OQ-005`. The commitment is only that whichever one is confirmed becomes
one adapter behind the fixed interface — not a rewrite of the callers.
`OQ-005`/`OQ-007` remain the traceable blockers; resolving them fills in
the adapter, it doesn't change the interface (`RULES.md` R022).

## 9. Docker architecture

### Services

| Service | Base | Purpose | Status |
|---|---|---|---|
| `frontend` | `node:22-alpine` (Next.js) | Serves the Next.js app | **Implemented** — `docker-compose.yml` (repo root), `frontend/Dockerfile` (multi-stage: `deps`/`dev`/`builder`/`runner`) |
| `backend` | Python (Django + DRF) | REST API, all domain modules | **Not yet provisioned** — no Django code exists (no `manage.py`, no models). Adding this container now would be empty scaffolding with nothing to run, which R018 argues against. Add when Sprint 2 introduces the Club data model. |
| `postgres` | Official `postgres` image | Primary datastore | **Not yet provisioned** — no backend exists to connect to it yet (same reasoning as `backend`). Add alongside `backend` in Sprint 2. |

`docker-compose.yml` currently defines only `frontend`, targeting the
Dockerfile's `dev` stage (source bind-mounted for hot reload; `npm run
dev` as the command). The `builder`/`runner` stages exist in the
Dockerfile for a future minimal production image (`next.config.ts` sets
`output: "standalone"`) but aren't wired into a production compose file
yet — no requirement currently demands a deployed environment.

### Deliberately not provisioned

| Service | Why not | Trigger to add |
|---|---|---|
| Redis | No confirmed caching/broker need | If Celery is introduced, or session/cache needs emerge post-`OQ-012` |
| Celery | No confirmed async/background task need | If e.g. `OQ-011`'s answer requires background file processing |
| WebSocket infra | No confirmed push-based real-time need | If `OQ-005` resolves toward push-based live scores |

`RULES.md` R018 requires justification before adding any of these.

### Network

**Today**: only `frontend` exists, on the default Compose network,
publishing `3000:3000` to the host. **Once `backend`/`postgres` are
added** (Sprint 2+): `frontend` reaches `backend` over the internal
Compose network (service name for server-side calls, a public path for
client-side calls, so the backend's real address is never exposed to the
browser); `backend` reaches `postgres` over the internal network only —
never host-mapped in production; no service but `backend` connects to
`postgres`.

### Storage

**Today**: `frontend`'s dev container uses two named volumes,
`frontend_node_modules` and `frontend_next_cache`, so the host bind-mount
(for hot reload) doesn't shadow the container's installed dependencies or
build cache. **Once `postgres` is added**: a named, persistent volume
(`postgres_data:/var/lib/postgresql/data`) — never anonymous/ephemeral.
Uploaded registration files (`REQ-REG-003`) will be stored via a
backend-managed volume/object-storage mount — exact mechanism is an LLD
decision once `OQ-011` resolves.

### Environment boundaries

`frontend/.env.example` is checked in (currently no variables are
actually required — the frontend has no backend to call yet and no
secrets of its own); real `.env*` files are git-ignored except that
template (`frontend/.gitignore` explicitly un-ignores `.env.example`).
**Secrets are never committed.** Once split into per-context env files
(`.env.development`, `.env.production`) with base + override Compose
files, that separation lands alongside the `backend`/`postgres` services.
The domain (`REQ-BRAND-002`) can't be finalized in any env file until
`OQ-001` resolves — development proceeds on `localhost:3000`.

### Health checks

**Today**: `frontend`'s healthcheck runs a Node one-liner (`fetch` against
`http://localhost:3000/`) inside the container — avoids depending on
`curl`/`wget` being present in the `node:22-alpine` image. **Once
`backend`/`postgres` are added**: `backend` gets an HTTP health endpoint
(e.g. `/health/`) returning 200 only when it can also reach `postgres`;
`postgres` gets the standard `pg_isready` check, used with `depends_on:
condition: service_healthy` so `backend` doesn't serve traffic before the
database actually accepts connections.

## 10. HLD / LLD boundary

**HLD** (this document): system architecture, major components, domain
boundaries, communication between components, infrastructure, major data
flows.

**LLD** (future, per-Sprint, not produced here): component/class
structure, concrete API contracts, validation rules, error handling,
per-endpoint permissions, exact DB fields/constraints, detailed data flow,
testing strategy. `RULES.md` R023: any feature with real business logic,
multiple states, or a permission boundary gets an LLD before code; simple
presentational requirements may proceed straight from this HLD +
Acceptance Criteria.

## 11. Major data flows

- **Public content read** (Home/About/News/Gallery/Contact info): Browser
  → Next.js (SSR/SSG) → DRF (`content`) → PostgreSQL.
- **Club directory/profile**: Browser → Next.js → DRF (`clubs`, filtered
  by approval-state) → PostgreSQL. Unapproved clubs never appear in the
  response — enforced server-side (`BR-001`), never just hidden in the
  frontend.
- **Club registration submission**: Browser → Next.js → DRF (`clubs`
  create endpoint) → PostgreSQL (new Club, approval-state = not approved)
  → file upload via backend-managed storage.
- **Tournament schedule/archives**: Browser → Next.js → DRF
  (`tournaments`/`matches`) → PostgreSQL.
- **Live scores/standings/statistics** (currently BLOCKED): once `OQ-005`
  resolves — [confirmed source] → Score/Match Data Service adapter
  (`matches`) → PostgreSQL → DRF (`standings`/`statistics`) → Next.js →
  Browser. Nothing beyond the adapter interface is built yet.

## 12. Architecture constraints (hard, binding for HLD/LLD/implementation)

1. Frontend must not directly access PostgreSQL.
2. Business logic must not be duplicated between frontend and backend.
3. Backend remains the authorization boundary (§7).
4. Components should be reusable where reuse is justified.
5. Component-specific styling uses SCSS Modules.
6. Domain modules (Django apps) maintain clear boundaries — no app reaches
   into another app's models directly.
7. Unresolved business requirements remain traceable to Open Questions.
8. No unnecessary infrastructure is introduced (§9).
9. The Score/Match Data Service (§8) must be a swappable adapter — no
   caller may hardcode which concrete source is in use.

## 13. Known architectural dependencies

| Element | Depends on | Current state |
|---|---|---|
| `accounts` real implementation | OQ-012 | Boundary defined, implementation deferred |
| RBAC role set | OQ-010 | Candidate shape only (§7) |
| Score/Match Data Service adapter | OQ-005 | Interface defined, adapter deferred |
| Standings computation | OQ-005, OQ-007 | Deferred |
| Statistics computation | OQ-005 (compounding), OQ-008 | Deferred |
| Club Directory map view | OQ-009 | List view only; map library choice deferred |
| Contact form backend handling | OQ-014 | Deferred |
| Possible WebSocket layer | OQ-005 (if push-based) | Not provisioned; conditional |
