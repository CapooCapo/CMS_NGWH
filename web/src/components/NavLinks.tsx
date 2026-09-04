"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/site";

/**
 * Primary nav links with an active state.
 *
 * A client component only because the active item depends on `usePathname`.
 * `aria-current="page"` is what conveys the active section to assistive
 * technology; the gold underline is the visual half of the same signal —
 * chosen over a filled pill because a painted baseline reads as court marking
 * and keeps the crimson bar clean.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // `/clubs/register` must not also light up `/clubs`.
  if (href === "/clubs") {
    return pathname === "/clubs" || /^\/clubs\/(?!register$)/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  labels,
  onNavigate,
  variant = "horizontal",
}: {
  labels: Record<string, string>;
  onNavigate?: () => void;
  variant?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();
  const vertical = variant === "vertical";

  return (
    <ul className={vertical ? "flex flex-col gap-1 py-1" : "flex items-center gap-1"}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={
                vertical
                  ? [
                      "flex items-center justify-between rounded-[var(--radius-md)] px-3.5 py-2.5 text-[length:var(--text-base)] font-semibold transition-colors duration-[var(--motion-fast)]",
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/85 hover:bg-white/10 hover:text-white",
                    ].join(" ")
                  : [
                      "relative flex h-11 items-center rounded-[var(--radius-md)] px-2.5 2xl:px-3 text-[length:var(--text-sm)] font-semibold transition-all duration-[var(--motion-fast)]",
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white",
                    ].join(" ")
              }
            >
              {labels[item.key] ?? item.key}
              {vertical && active && (
                <span aria-hidden="true" className="text-accent text-xs">
                  ●
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
