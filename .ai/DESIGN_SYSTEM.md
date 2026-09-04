# NGWH Design System

The visual system for the NextGen Women Hoops platform. Written before the
redesign and kept as the reference for it.

## Subject and stance

A U20 **women's basketball** organization in Vietnam (`.ai/REQUIREMENTS.md`).
Not a SaaS product. The design should read the way a league's own media looks:
bold, athletic, editorial, premium — competition results presented with
confidence, not decorated.

The brand is **not being reinvented**. REQ-BRAND-001/003 fix the name and
tagline, and the existing NGWH reference is deep crimson with a gold accent on
near-black. Those stay; what changes is precision, hierarchy and restraint.

## What was wrong with the previous pass

Recorded so the redesign does not drift back:

1. **One card for everything.** 18 identical `border + bg-background +
   rounded-lg` blocks and 22 `rounded-lg` usages. Border, fill, radius and
   shadow each mean "separate object"; spending all four on every block
   flattens the hierarchy so nothing reads as primary.
2. **Accent-rail section headings.** A small gold bar beside every `h2` — a
   generic AI-dashboard tell, and it carried no information.
3. **Generic type.** Geist Sans/Mono is the safe default face. It gives the
   page no voice, and nothing about it says basketball.
4. **Three near-identical reds.** `--brand #a4123c`, `--live #d62839` and
   `--danger #b3261e` were visually interchangeable, so brand, live state and
   destructive action all looked the same.
5. **No spacing, radius or motion scale.** Arbitrary Tailwind values chosen
   per component, so rhythm drifted between pages.

## Color

Warm-biased neutrals, derived from hardwood and painted court lines, so the
greys read as chosen rather than inherited. Six named values:

| Token | Light | Role |
|---|---|---|
| `--crimson` | `#9E0E33` | Primary brand. Header, primary actions, active nav. |
| `--gold` | `#E0A011` | Accent. Eyebrows, category tags, one CTA per view. |
| `--court` | `#0E0C0B` | Warm near-black. Hero and scoreboard grounds. |
| `--chalk` | `#FBF9F7` | Warm paper. Page ground. |
| `--hardwood` | `#F1EAE3` | Warm mid surface. Section bands, table headers. |
| `--slate` | `#6B625C` | Warm muted text. |

Semantic color is a **separate set** from the accent and is never used
decoratively:

- `--live #E11D2E` — reserved for a match in progress. Nothing else.
- `--success #167C4A`, `--warning #9A6400`, `--danger #B4471C` (orange-biased,
  so a destructive action never reads as brand crimson).

Both themes are defined at token level: complete light palette on bare
`:root`, dark redefined under `prefers-color-scheme: dark` guarded by
`:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`.
Every component styles through tokens only.

## Type

Two families, deliberately paired, both carrying the `vietnamese` subset so EN
and VI are set in the same faces at the same weights — no separate visual
treatment per locale.

- **Archivo** — display. A grotesque with athletic/signage lineage. Used at
  700–900 with tight negative tracking for headlines, scores and stat figures;
  `tabular-nums` wherever digits align. This is the voice.
- **Be Vietnam Pro** — body and UI. Designed for Vietnamese typography, so
  diacritics are drawn rather than approximated at every weight. A real
  subject-grounded choice for a Vietnamese organization, not a default.

Scale (`--text-*`), fluid only where it earns it (hero). Headings get
`text-wrap: balance`; running prose is capped near 68ch; uppercase eyebrows
carry `0.12em` tracking.

## Layout — "court lines"

Section boundaries are drawn with **precise hairline rules**, the way a court
is painted, instead of wrapping every group in a bordered card. The dark
`--court` panel is reserved for two things: the hero and live scoreboards.
Data lives in flat, rule-separated tables with tabular numerals.

Consequences:

- Radius is small and meaningful: `--radius-sm 3px` for controls, `--radius-md
  6px` for genuinely lifted objects, `--radius-pill` for status only. No
  blanket `rounded-lg`.
- Elevation is rare. One shadow token, used on hover of interactive cards and
  on overlays. Static content does not float.
- Section headings: uppercase gold eyebrow → display headline → hairline rule.
  The rule marks the boundary, which is information; the old rail was not.

Spacing scale `--space-1..12` on a 4px base, applied through flex/grid `gap`
rather than per-element margins.

Breakpoints stay Tailwind's (`sm 640 / md 768 / lg 1024 / xl 1280`). Mobile is
composed, not shrunk: tables scroll inside their own container with a sticky
first column and a visible edge affordance; the header collapses to a drawer;
the hero drops to a shorter crop with the headline still in the first frame.

## Components

Primitives live in `src/components/ui/`. Variants are named by role, not size:

- **Button** — `primary` (crimson), `accent` (gold), `outline`, `ghost`,
  `danger`. Every variant has hover, focus-visible, active, disabled and a
  `loading` state that keeps its width so nothing shifts.
- **Card** — `flat` (rules only), `raised` (border + hover shadow, for links),
  `panel` (dark court ground). Not one card for everything.
- **Field** — label, optional hint, error text wired with
  `aria-invalid`/`aria-describedby`, consistent control height.
- **Table** — scroll container, sticky first column, `--hardwood` header,
  tabular numerals, `caption` for screen readers.
- **Badge** — `neutral`, `brand`, `accent`, `live`, `success`, `warning`,
  `muted`. Status only.
- **States** — `EmptyState`, `ErrorState`, `Skeleton`, `Toast` share one
  visual language so a failure never looks like an empty result.

## Motion

Restrained and functional. Two durations (`--motion-fast 120ms`,
`--motion-base 200ms`) and one easing. Permitted: control hover/focus
transitions, the live-status dot pulse, hero crossfade, drawer and lightbox
entry. Not permitted: scroll reveals, parallax, decorative loops. Everything
sits at a visible resting state on load, and the existing
`prefers-reduced-motion` block reduces all of it to near-zero.

## Rules

1. Tokens, never arbitrary values, for color, spacing, radius and duration.
2. One design language across public and admin. Admin differs in **density**,
   not in visual identity.
3. All copy through `next-intl`; no hardcoded UI strings.
4. Images through `urlForImage()` with fixed aspect ratios so nothing shifts.
5. Accessibility and SEO behaviour already verified must not regress.
