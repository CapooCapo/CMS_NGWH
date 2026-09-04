"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { NavLinks } from "./NavLinks";
import { buttonClass } from "./ui";

/**
 * Mobile navigation drawer.
 *
 * Designed for the phone rather than shrunk from the desktop bar: the eight
 * destinations become a full-height list with generous touch targets, the
 * primary action (registration) is pinned as a full-width button at the
 * bottom where a thumb reaches it, and the locale switcher travels with it.
 *
 * Accessibility behaviour a plain toggle would miss:
 *  - the trigger owns `aria-expanded` / `aria-controls`;
 *  - Escape closes, and focus returns to the trigger;
 *  - focus moves into the panel on open and is trapped while open, so Tab
 *    cannot land on the page behind the overlay;
 *  - body scroll is locked while open.
 */
export function MobileNav({
  labels,
  registerLabel,
  children,
}: {
  labels: Record<string, string>;
  registerLabel?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Return focus to the trigger after closing, but not on first render.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.closeMenu : labels.openMenu}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-white transition-colors duration-[var(--motion-fast)] hover:bg-white/15"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />}
        </svg>
      </button>

      {open && (
        <>
          {/* Decorative: Escape and the close button are the accessible exits. */}
          <div
            className="fixed inset-0 z-40 bg-court/70 backdrop-blur-[2px]"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={labels.primary}
            className="on-court fixed inset-y-0 right-0 z-50 flex w-[min(20rem,88vw)] flex-col rounded-l-[var(--radius-xl)] bg-brand-strong shadow-[var(--shadow-overlay)]"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/15 pl-5 pr-3">
              <span className="eyebrow text-white/70">{labels.menu}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.closeMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-white transition-colors duration-[var(--motion-fast)] hover:bg-white/15"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav aria-label={labels.primary} className="flex-1 overflow-y-auto px-5 py-2">
              <NavLinks labels={labels} variant="vertical" onNavigate={() => setOpen(false)} />
            </nav>

            <div className="shrink-0 space-y-4 border-t border-white/15 p-5">
              {registerLabel && (
                <Link
                  href="/clubs/register"
                  onClick={() => setOpen(false)}
                  className={buttonClass("accent", "w-full")}
                >
                  {registerLabel}
                </Link>
              )}
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
