import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { Eyebrow } from "@/components/ui";
import { AdminNav } from "./AdminNav";
import { LogoutButton } from "./LogoutButton";
import type { AdminIdentity } from "@/server/auth/session";

/**
 * Admin chrome: a dark court-ground sidebar on desktop that becomes a
 * horizontal section scroller on small screens.
 *
 * Same design language as the public site — same faces, tokens, badges and
 * tables — but denser: tighter rhythm, smaller type, more rows per screen.
 * It deliberately does not reuse `SiteHeader`; mixing the two would let an
 * operator wander into the public nav mid-task, and the two surfaces have very
 * different information density.
 */
export function AdminShell({
  admin,
  children,
}: {
  admin: AdminIdentity;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <a href="#admin-main" className="skip-link">
        Skip to main content
      </a>
      <div className="on-court flex shrink-0 flex-col border-b border-ink-border bg-ink text-ink-foreground lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center gap-2.5 px-4 lg:h-16">
          <Link
            href="/admin/dashboard"
            className="min-w-0 text-white transition-opacity duration-[var(--motion-fast)] hover:opacity-85"
          >
            <BrandMark />
          </Link>
        </div>

        <AdminNav role={admin.role} />

        <div className="mt-auto hidden border-t border-ink-border p-3 lg:block">
          <div className="flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-3 shadow-[var(--shadow-xs)]">
            <div className="min-w-0">
              <p className="truncate text-[length:var(--text-sm)] font-semibold text-white">
                {admin.username}
              </p>
              <Eyebrow tone="muted" className="mt-0.5 !text-ink-muted">
                {admin.role}
              </Eyebrow>
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {/* Signed-in identity on small screens, where the sidebar footer is hidden. */}
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <p className="truncate text-[length:var(--text-xs)] text-muted">
            <span className="font-semibold text-foreground">{admin.username}</span>{" "}
            · {admin.role}
          </p>
          <LogoutButton tone="light" />
        </div>
        <main id="admin-main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Admin page masthead. Denser than the public `PageHeader`, same rhythm. */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        <h1 className="text-[length:var(--text-2xl)] font-extrabold leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-[68ch] text-[length:var(--text-sm)] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Titled block used to group admin content without stacking cards. */
export function AdminSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="eyebrow flex items-center gap-2 text-muted">
          {title}
          {count !== undefined && (
            <span className="tabular rounded-[var(--radius-pill)] bg-surface-strong px-2 py-0.5 text-foreground">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
