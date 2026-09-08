"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isPrivileged, type AdminRole } from "@/server/auth/permissions";

/**
 * Admin navigation.
 *
 * `roles` on each item mirrors the `requireRole()` guard on the matching API
 * routes, so a user is not shown a section whose endpoints would reject them.
 * This is a usability measure, not the access control — that lives server-side.
 */
const ITEMS: {
  href: string;
  labelKey: string;
  roles: readonly AdminRole[] | null;
}[] = [
  { href: "/admin/dashboard", labelKey: "dashboard", roles: null },
  { href: "/admin/registrations", labelKey: "registrations", roles: ["editor"] },
  { href: "/admin/clubs", labelKey: "clubs", roles: ["editor"] },
  { href: "/admin/seasons", labelKey: "seasons", roles: ["editor", "operator"] },
  { href: "/admin/matches", labelKey: "matches", roles: ["editor", "operator"] },
  { href: "/admin/contact", labelKey: "contact", roles: ["editor"] },
  { href: "/admin/users", labelKey: "users", roles: [] },
  { href: "/admin/audit-logs", labelKey: "auditLogs", roles: [] },
];

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  /*
   * `superadmin` and `admin` see every section. Other roles see the sections
   * whose API guards would accept them — `subadmin` is read-only, so it sees
   * the business sections but every mutation there is refused server-side.
   *
   * This is navigation convenience only; `guard.ts` is the authority.
   */
  const visible = ITEMS.filter((item) => {
    if (isPrivileged(role)) return true;
    if (item.roles === null) return true;
    if (role === "subadmin") return item.roles.length > 0;
    return item.roles.includes(role);
  });

  return (
    <nav
      aria-label={t("label")}
      className="px-2 pb-2 lg:mt-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0"
    >
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                /*
                 * Active state is a gold leading edge — the same signal the
                 * public nav uses as an underline, rotated for a sidebar.
                 */
                className={`relative flex items-center whitespace-nowrap rounded-[var(--radius-md)] px-3.5 py-2.5 text-[length:var(--text-sm)] font-semibold transition-all duration-[var(--motion-fast)] lg:pl-4 ${
                  active
                    ? "bg-white/12 text-white shadow-[var(--shadow-xs)] lg:before:absolute lg:before:inset-y-1.5 lg:before:left-0 lg:before:w-[3px] lg:before:rounded-full lg:before:bg-accent"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
