/**
 * Site-wide constants.
 *
 * REQ-BRAND-001 — the name. Both forms in the requirement are kept: the full
 * name for prose/metadata and the short form for tight spaces like the header.
 * OQ-002 only asks whether this branding is final, so the value is usable now.
 *
 * REQ-BRAND-003 — the tagline.
 *
 * REQ-BRAND-002 (domain) is BLOCKED by OQ-001: the requirement gives two
 * mutually exclusive domains (nextgenwomenhoops.com and u20wbc.com) and no
 * choice has been made. Rather than pick one and bake a guess into every
 * canonical URL and Open Graph tag, the origin is read from
 * NEXT_PUBLIC_SITE_URL and falls back to localhost. Setting that env var at
 * deploy time is what resolves OQ-001 in practice; no domain is hard-coded.
 */
export const SITE_NAME = "NextGen Women Hoops";
export const SITE_NAME_SHORT = "NG Women Hoops";
export const SITE_TAGLINE = "Where Tomorrow's Legends Rise";

const FALLBACK_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Absolute origin used for metadataBase, canonicals, sitemap and robots. */
export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return FALLBACK_ORIGIN;
  try {
    // Normalise away any trailing path/slash so joins are predictable.
    return new URL(raw).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteOrigin()).toString();
}

/**
 * Primary navigation. `key` indexes the `nav` namespace in
 * `messages/{en,vi}.json`; `href` is the canonical path.
 */
export const NAV_ITEMS = [
  { key: "home", href: "/" },
  { key: "about", href: "/about" },
  { key: "tournaments", href: "/tournaments" },
  { key: "news", href: "/news" },
  { key: "gallery", href: "/gallery" },
  { key: "clubs", href: "/clubs" },
  { key: "register", href: "/clubs/register" },
  { key: "contact", href: "/contact" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
