import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NAV_ITEMS, SITE_NAME } from "@/lib/site";
import { OwnerNavStatus } from "./owner/OwnerNavStatus";
import { BrandMark } from "./BrandMark";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";

/**
 * Site header: brand, primary navigation, locale switcher and the one
 * cross-site primary action (club registration).
 *
 * The crimson bar is the brand's strongest surface, so it carries no other
 * colour: the active section is marked by a gold baseline (see NavLinks) and
 * the single accent-filled control is the registration CTA. Below `lg` the
 * eight destinations do not fit, so the nav collapses into a drawer; both
 * variants share `NavLinks` so labels and active logic cannot drift.
 */
export async function SiteHeader() {
  const t = await getTranslations("nav");

  // Resolved server-side and handed down, so client components need no
  // translation context of their own.
  const labels: Record<string, string> = {
    menu: t("menu"),
    openMenu: t("openMenu"),
    closeMenu: t("closeMenu"),
    primary: t("primary"),
  };
  for (const item of NAV_ITEMS) labels[item.key] = t(item.key);

  return (
    <header className="on-court sticky top-0 z-40 border-b border-brand-strong bg-brand text-white">
      {/* xl+: 3-column grid so nav is always perfectly centred.
           Smaller viewports: plain flex row (logo on left, actions on right,
           hamburger between them) — unchanged from the previous layout. */}
      <div className="flex h-16 w-full items-center px-4 sm:px-6 lg:px-8 xl:grid xl:grid-cols-[auto_1fr_auto]">
        <Link
          href="/"
          aria-label={SITE_NAME}
          className="inline-flex h-11 shrink-0 items-center self-center rounded-[var(--radius-md)] text-white transition-opacity duration-[var(--motion-fast)] hover:opacity-85"
        >
          {/* Icon-only on the narrowest phones: the wordmark would otherwise
              push the row past the viewport. */}
          <span className="hidden sm:inline-flex sm:items-center">
            <BrandMark />
          </span>
          <span className="sm:hidden inline-flex items-center">
            <BrandMark showText={false} />
          </span>
        </Link>

        {/*
          The eight primary destinations only fit from xl up once VI labels are
          measured, so tablet gets the drawer too rather than a cramped or
          overflowing bar.
          On xl+ the nav sits in the 1fr centre column and uses justify-center
          so it is truly horizontally centred between logo and auth actions.
        */}
        <nav aria-label={labels.primary} className="hidden xl:flex xl:items-center xl:justify-center">
          <NavLinks labels={labels} />
        </nav>

        <div className="ml-auto xl:ml-0 flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex sm:items-center">
            <LanguageSwitcher />
          </div>
          <div className="hidden lg:flex lg:items-center">
            <OwnerNavStatus />
          </div>
          <MobileNav labels={labels}>
            <div className="sm:hidden">
              <LanguageSwitcher />
            </div>
            <div className="lg:hidden">
              <OwnerNavStatus layout="stack" />
            </div>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
