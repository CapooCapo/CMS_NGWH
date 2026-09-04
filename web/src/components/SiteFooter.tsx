import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SITE_NAME } from "@/lib/site";
import { BrandMark } from "./BrandMark";
import { Eyebrow } from "./ui";

/**
 * Site footer on the dark court ground — the visual bookend to the crimson
 * header, so the page closes in brand rather than trailing off.
 *
 * The eight destinations are grouped into three labelled columns; each column
 * is its own `<nav>` with an accessible name, so a screen-reader user hears
 * three named groups instead of one long link list.
 */
export async function SiteFooter() {
  const [t, nav, brand, live] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
    getTranslations("brand"),
    getTranslations("live"),
  ]);

  const columns = [
    {
      heading: t("explore"),
      links: [
        { href: "/tournaments", label: nav("tournaments") },
        { href: "/news", label: nav("news") },
        { href: "/gallery", label: nav("gallery") },
        { href: "/live", label: live("title") },
      ],
    },
    {
      heading: t("forClubs"),
      links: [
        { href: "/clubs", label: nav("clubs") },
        { href: "/clubs/register", label: nav("register") },
      ],
    },
    {
      heading: t("getInTouch"),
      links: [
        { href: "/about", label: nav("about") },
        { href: "/contact", label: nav("contact") },
      ],
    },
  ];

  return (
    <footer className="on-court mt-auto bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <BrandMark className="text-white" />
            <p className="mt-4 max-w-[26ch] font-display text-[length:var(--text-lg)] font-bold leading-tight text-accent">
              {brand("tagline")}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <Eyebrow tone="muted" className="!text-ink-muted">
                {column.heading}
              </Eyebrow>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[length:var(--text-sm)] text-white/80 transition-colors duration-[var(--motion-fast)] hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-ink-border pt-6 text-[length:var(--text-xs)] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. {t("rights")}
          </p>
          <p className="max-w-[52ch] sm:text-right">{t("demoNotice")}</p>
        </div>
      </div>
    </footer>
  );
}
