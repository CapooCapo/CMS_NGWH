import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { currentOwner } from "@/server/auth/ownerSession";
import { OwnerLogoutButton } from "./OwnerLogoutButton";
import { OwnerAvatarMenu } from "./OwnerAvatarMenu";

/**
 * The one navigation surface that makes the Club Owner workflow discoverable
 * without knowing the URL: a "Login" link when signed out, or an account
 * avatar with Profile and Clubs when signed in. Rendered in both `SiteHeader`
 * (desktop) and `MobileNav` (drawer) so the workflow is reachable everywhere
 * the rest of the primary navigation is.
 *
 * Server component so it can read the session directly — no client-side
 * "am I logged in" flicker, and no session state duplicated into a client
 * store.
 */
export async function OwnerNavStatus({
  layout = "row",
}: {
  layout?: "row" | "stack";
}) {
  const [t, owner] = await Promise.all([getTranslations("myClub"), currentOwner()]);

  if (!owner) {
    if (layout === "stack") {
      return (
        <div className="flex flex-col gap-2.5">
          <Link
            href="/signup"
            className="flex h-11 min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-accent px-4 text-[length:var(--text-sm)] font-bold text-accent-contrast shadow-[var(--shadow-xs)] transition-all duration-[var(--motion-fast)] hover:bg-accent-strong hover:shadow-[var(--shadow-sm)] active:scale-[0.98]"
          >
            {t("signupNavLabel")}
          </Link>
          <Link
            href="/login"
            className="flex h-11 min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] border border-white/30 bg-white/5 px-4 text-[length:var(--text-sm)] font-semibold text-white transition-colors duration-[var(--motion-fast)] hover:border-white hover:bg-white/15 active:scale-[0.98]"
          >
            {t("loginNavLabel")}
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-[var(--radius-md)] px-3.5 text-[length:var(--text-sm)] font-semibold text-white/90 transition-colors duration-[var(--motion-fast)] hover:bg-white/10 hover:text-white"
        >
          {t("loginNavLabel")}
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-accent px-4.5 text-[length:var(--text-sm)] font-bold text-accent-contrast shadow-[var(--shadow-xs)] transition-all duration-[var(--motion-fast)] hover:bg-accent-strong hover:shadow-[var(--shadow-sm)] active:scale-[0.98]"
        >
          {t("signupNavLabel")}
        </Link>
      </div>
    );
  }

  if (layout === "stack") {
    return (
      <div className="flex flex-col gap-2.5">
        <Link
          href="/profile"
          className="flex h-11 min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-white/15 px-4 text-[length:var(--text-sm)] font-semibold text-white transition-colors duration-[var(--motion-fast)] hover:bg-white/20"
        >
          {t("profileNavLabel")}
        </Link>
        <Link
          href="/my-clubs"
          className="flex h-11 min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-white/15 px-4 text-[length:var(--text-sm)] font-semibold text-white transition-colors duration-[var(--motion-fast)] hover:bg-white/20"
        >
          {t("clubsNavLabel")}
        </Link>
        <OwnerLogoutButton label={t("logoutLabel")} tone="dark" className="w-full" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <OwnerAvatarMenu
        name={owner.full_name?.trim() || owner.email}
        labels={{
          menu: t("accountMenuLabel"),
          profile: t("profileNavLabel"),
          clubs: t("clubsNavLabel"),
          logout: t("logoutLabel"),
        }}
      />
    </div>
  );
}
