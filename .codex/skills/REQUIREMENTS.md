# Requirements

## Purpose

Concise, navigable requirement reference for implementation work — the
"what" and "current status" of every requirement. The detailed extraction
(exact source quotes, business rules, acceptance criteria, full traceability)
remains in `Requirement_Analysis.xlsx`; this file does not duplicate it,
it summarizes it for day-to-day use so Claude Code doesn't need to open
the workbook for every task.

## Source of truth

`Requirement_Analysis.xlsx` (sheets: `REQUIREMENTS`, `ACCEPTANCE_CRITERIA`,
`BUSINESS_RULES`, `OPEN_QUESTIONS`, `TRACEABILITY`, `CHANGE_LOG`) and
`Giai doan 1.docx` remain authoritative and are **not modified** by this
file. If this summary and the workbook ever disagree, the workbook wins —
treat that as a sign this file needs regenerating, not the other way round.

37 requirements, 15 Open Questions (`OQ-001`–`OQ-015`). `OQ-003` was
closed 2026-08-18 (stakeholder confirmed video as the Home Hero format —
`Requirement_Analysis.xlsx` `CHANGE_LOG` v1.1); the remaining 14 are
Open. Status values:

- **READY** — sufficiently defined; implementable now, no pending decision.
- **PARTIALLY_READY** — some scope is implementable now; the rest depends
  on an unresolved Open Question (see that requirement's OQ column).
- **BLOCKED** — implementation requires a decision an Open Question is
  currently asking; no meaningful scope can proceed.
- **NEEDS_REVIEW** — ambiguous, contradictory, or has a real gap not yet
  captured by any Open Question (so it can't correctly be called
  "blocked" — nothing is tracking it yet).

## Important gap — read before planning Login/Register/Forgot Password work

**"Login," "Register" (as a general user account system), and "Forgot
Password" are not requirements in this workbook.** The only account/login-
shaped requirements that actually exist are `REQ-REG-004`/`REQ-REG-005`
(Club Dashboard login, for club organizations) and `REQ-REG-001`/`002`/`003`
(Club Registration, an organization registering — not an individual signing
up). There is zero requirement, business rule, or Open Question for a
generic end-user account system or password reset anywhere in
`Requirement_Analysis.xlsx` or `Giai doan 1.docx`. If future work asks for
these features, treat them as **new scope requiring a new requirement and
Open Questions** — do not fold them into REG-001..005 or invent them.

---

## Requirements by module

### Branding

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-BRAND-001 | Website branded "NextGen Women Hoops" / "NG Women Hoops" | Must | READY* | OQ-002 (confirmation only — doesn't block the value) |
| REQ-BRAND-002 | Domain: nextgenwomenhoops.com **or** u20wbc.com | Must | BLOCKED | OQ-001 (Conflict — two exclusive values, no choice made) |
| REQ-BRAND-003 | Tagline "Where Tomorrow's Legends Rise" | Must | READY | — |

### Home Page

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-HOME-001 | Hero section: banner or video of tournament highlights | Must | READY** | OQ-003 (Closed) |
| REQ-HOME-002 | Tagline displayed in Hero | Must | READY | — |
| REQ-HOME-003 | Short mission overview | Must | READY | — |
| REQ-HOME-004 | "Hot News" — 3 to 5 latest/upcoming items (BR-002) | Must | READY | — |
| REQ-HOME-005 | "Live & Results" quick scoreboard | Must | READY | OQ-004, OQ-005 (Closed 2026-08-20) |
| REQ-HOME-006 | "Champions Corner" — defending champion | Must | READY | — |

### About Us

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-ABOUT-001 | Brand Story (vision/mission) | Must | READY | — |
| REQ-ABOUT-002 | Tournament System (standards: tech/referee/intl) | Must | PARTIALLY_READY | OQ-006 (copy only) |
| REQ-ABOUT-003 | Organizing Committee & Partners | Must | READY | — |

### Tournaments

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-TOURN-001 | Match schedule by date/time | Must | READY | — |
| REQ-TOURN-002 | Standings, automatically updated | Must | BLOCKED | OQ-005, OQ-007 |
| REQ-TOURN-003 | Stats — top scorer, top assists (+ unspecified categories) | Must | BLOCKED | OQ-008 |
| REQ-TOURN-004 | Archives — list of past seasons | Must | READY | — |

### Gallery / Hall of Fame

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-GALLERY-001 | Championship Moments Library (photo/video) | Must | NEEDS_REVIEW | *(none logged yet — video sourcing/hosting is undefined, the same kind of gap `OQ-003` tracks for the Home hero, but no Open Question currently covers Gallery. Photo-album display is unaffected and may proceed.)* |
| REQ-GALLERY-002 | MVP Spotlight | Must | READY | — |
| REQ-GALLERY-003 | Behind-the-Scenes Stories | Must | READY | — |

### Clubs Directory

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-CLUB-001 | Club directory — map and/or list, nationwide | Must | PARTIALLY_READY | OQ-009 (map slice) |
| REQ-CLUB-002 | Filter directory by province/region | Must | READY | — |
| REQ-CLUB-003 | Club Profile shown only after approval (BR-001) | Must | PARTIALLY_READY | OQ-010 (approver role/admin action) |
| REQ-CLUB-004 | Profile: name/logo/founding year/achievements | Must | READY | — |
| REQ-CLUB-005 | Profile: roster & coaching staff | Must | READY | — |
| REQ-CLUB-006 | Profile: contact info & social links | Must | READY | — |

**Club approval and document visibility (product decision, 2026-09-04).** Only
approved Clubs are publicly visible. Every document belonging to an approved
Club is public with that Club; pending and rejected Clubs and their documents
remain private. Club creators and authorized administrators retain access to
private documents through authenticated interfaces. Individual document
approval is not required and `registration_documents.is_public` is legacy
metadata, not a public-visibility rule.

### Club Registration

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-REG-001 | Registration portal, standardized form (container) | Must | READY | — |
| REQ-REG-002 | Form: name, operating region, representative | Must | READY | — |
| REQ-REG-003 | Upload: capability profile / U20 athlete list | Must | PARTIALLY_READY | OQ-011 (validation rules) |
| REQ-REG-004 | Club Dashboard, authenticated access only | Must | BLOCKED | OQ-012 |
| REQ-REG-005 | Authenticated roster/personnel updates before each season (BR-004) | Must | BLOCKED | OQ-013 (+ depends on REG-004) |

### News & Media

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-NEWS-001 | Tournament news (updates/analysis) | Must | READY | — |
| REQ-NEWS-002 | Inspirational stories / interviews | Must | READY | — |
| REQ-NEWS-003 | Knowledge & Nutrition articles | Must | READY | — |

### Contact

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-CONTACT-001 | Office info, hotline, support email(s) | Must | READY | — |
| REQ-CONTACT-002 | Contact/feedback form | Must | BLOCKED | OQ-014 |

### Global / Cross-cutting

| ID | Requirement | Priority | Status | OQ |
|---|---|---|---|---|
| REQ-GLOBAL-001 | Multi-language support, minimum VI/EN | Should | READY | — |
| REQ-GLOBAL-002 | Data-driven scoreboards/standings/profiles, "FIBA/NBA-quality" | Should | NEEDS_REVIEW | OQ-015 (untestable as written) |

*REQ-BRAND-001: the value itself is usable now; `OQ-002` only asks whether it's the client's final direction.

**REQ-HOME-001: `OQ-003` closed 2026-08-18 — video confirmed as the Hero
format (`Requirement_Analysis.xlsx` `CHANGE_LOG` v1.1). The Hero was
rebuilt as a video carousel; the pre-existing hero photo is retained
only as the poster/error-fallback image, not as an independent "both
formats" requirement.

---

## Business Rules (summary — full text in workbook `BUSINESS_RULES` sheet)

| ID | Rule | Linked requirement |
|---|---|---|
| BR-001 | Club profile shown only after registration approved | REQ-CLUB-003 |
| BR-002 | Hot News shows 3–5 items | REQ-HOME-004 |
| BR-003 | Minimum 2 languages (VI/EN) | REQ-GLOBAL-001 |
| BR-004 | Clubs update roster before each season | REQ-REG-005 |

## Open Questions (summary — full text in workbook `OPEN_QUESTIONS` sheet)

14 of 15 remain `Open`. `OQ-003` is `Closed` (2026-08-18,
`Requirement_Analysis.xlsx` `CHANGE_LOG` v1.1) — the only Open Question
answered/closed by any planning document to date.

| OQ | Topic | Blocks |
|---|---|---|
| OQ-001 | Which domain (conflict — two given) | REQ-BRAND-002 |
| OQ-002 | Is "Option 1" branding final? | REQ-BRAND-001 (confirmation only) |
| OQ-003 | **Closed** — Home hero confirmed video | REQ-HOME-001 |
| OQ-004 | **Closed** (2026-08-20) — Show live match first, else most recently finished match | REQ-HOME-005 |
| OQ-005 | **Closed** (2026-08-20) — Use existing match DB architecture | REQ-HOME-005, REQ-TOURN-002 (+ compounds REQ-TOURN-003) |
| OQ-006 | Which tech/standards to name in About Us | REQ-ABOUT-002 |
| OQ-007 | Standings update mechanism/frequency | REQ-TOURN-002 |
| OQ-008 | Full statistics category list | REQ-TOURN-003 |
| OQ-009 | Club directory: map, list, or both | REQ-CLUB-001 |
| OQ-010 | Club registration approver role | REQ-CLUB-003 |
| OQ-011 | Upload format/size limits | REQ-REG-003 |
| OQ-012 | Club Dashboard authentication method | REQ-REG-004 |
| OQ-013 | Roster-update deadline | REQ-REG-005 |
| OQ-014 | Contact form fields/routing | REQ-CONTACT-002 |
| OQ-015 | Measurable criteria for "FIBA/NBA-quality" | REQ-GLOBAL-002 |

## Where the rest of this data lives

- Full per-requirement dependency chains, rework risk, and Sprint
  assignment → `SPRINT_PLAN.md`.
- Architecture-level dependencies (which system component each unresolved
  OQ blocks) → `ARCHITECTURE.md` §13.
- Verbatim source text, page/section references, full Acceptance Criteria
  Given/When/Then → `Requirement_Analysis.xlsx`.
