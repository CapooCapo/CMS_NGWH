"use client";

import Link from "next/link";
import { OwnerLogoutButton } from "./OwnerLogoutButton";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)![0]}` : words[0]?.slice(0, 2) ?? "O")
    .toUpperCase();
}

/** Account navigation for an authenticated Club Owner. */
export function OwnerAvatarMenu({
  name,
  labels,
}: {
  name: string;
  labels: {
    menu: string;
    profile: string;
    clubs: string;
    logout: string;
  };
}) {
  return (
    <details className="group relative">
      <summary
        aria-label={labels.menu}
        className="flex h-11 min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-[var(--radius-md)] px-1.5 text-white transition-colors hover:bg-white/10 [&::-webkit-details-marker]:hidden"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[length:var(--text-xs)] font-extrabold text-accent-contrast">
          {initials(name)}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 flex w-52 flex-col gap-1 rounded-[var(--radius-lg)] border border-border bg-surface p-2 text-foreground shadow-[var(--shadow-md)]">
        <p className="truncate px-3 py-2 text-[length:var(--text-xs)] font-semibold text-muted">
          {name}
        </p>
        <Link
          href="/profile"
          className="rounded-[var(--radius-md)] px-3 py-2.5 text-[length:var(--text-sm)] font-semibold transition-colors hover:bg-surface-sunken"
        >
          {labels.profile}
        </Link>
        <Link
          href="/my-clubs"
          className="rounded-[var(--radius-md)] px-3 py-2.5 text-[length:var(--text-sm)] font-semibold transition-colors hover:bg-surface-sunken"
        >
          {labels.clubs}
        </Link>
        <div className="mt-1 border-t border-border pt-1">
          <OwnerLogoutButton label={labels.logout} tone="plain" className="w-full justify-start" />
        </div>
      </div>
    </details>
  );
}
