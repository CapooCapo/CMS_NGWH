"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryPhoto = {
  key: string;
  thumbUrl: string;
  fullUrl: string;
  alt: string;
  caption: string | null;
};

/**
 * Photo grid with a lightbox (REQ-GALLERY-001, photo-album slice — the video
 * slice is NEEDS_REVIEW and deliberately not implemented).
 *
 * The grid degrades to plain images if JavaScript never runs, because each
 * tile is a real `<button>` around an already-rendered `<img>`; the lightbox is
 * additive. Inside the dialog: Escape closes, Arrow keys page, focus is trapped
 * and restored to the tile that opened it.
 */
export function GalleryGrid({
  photos,
  labels,
  columns = "three",
  priority = false,
}: {
  photos: readonly GalleryPhoto[];
  labels: {
    open: string;
    close: string;
    previous: string;
    next: string;
    counter: string;
  };
  columns?: "three" | "four";
  /**
   * Marks the first tile as above-the-fold. Only the first grid on a page
   * should set this: it eagerly loads that one image so it is not the
   * lazy-loaded Largest Contentful Paint element.
   */
  priority?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastOpener = useRef<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const move = useCallback(
    (delta: number) =>
      setOpenIndex((i) =>
        i === null ? null : (i + delta + photos.length) % photos.length
      ),
    [photos.length]
  );

  useEffect(() => {
    if (openIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Tab") {
        // Trap focus inside the dialog.
        const items = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled])'
          ) ?? []
        );
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
      }
    };
    document.addEventListener("keydown", onKeyDown);
    // Focus the close control so the dialog is immediately operable.
    const raf = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, move]);

  // Restore focus to the tile that opened the lightbox.
  useEffect(() => {
    if (openIndex === null && lastOpener.current !== null) {
      triggerRefs.current[lastOpener.current]?.focus();
      lastOpener.current = null;
    }
  }, [openIndex]);

  const active = openIndex === null ? null : photos[openIndex];
  const counter = (index: number) =>
    labels.counter
      .replace("{index}", String(index + 1))
      .replace("{total}", String(photos.length));

  return (
    <>
      <ul
        className={`grid gap-3 sm:gap-4 ${
          columns === "four"
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {photos.map((photo, index) => (
          <li key={photo.key}>
            <button
              ref={(el) => {
                triggerRefs.current[index] = el;
              }}
              type="button"
              onClick={() => {
                lastOpener.current = index;
                setOpenIndex(index);
              }}
              aria-label={`${labels.open}: ${photo.alt || counter(index)}`}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-sm)] bg-surface-strong"
            >
              <Image
                src={photo.thumbUrl}
                alt={photo.alt}
                fill
                priority={priority && index === 0}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.05]"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center bg-court/45 opacity-0 transition-opacity duration-[var(--motion-base)] group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <div
          className="on-court fixed inset-0 z-50 flex flex-col bg-court/95"
          role="dialog"
          aria-modal="true"
          aria-label={counter(openIndex!)}
          ref={dialogRef}
        >
          <div className="flex items-center justify-between gap-3 p-3 text-white">
            <span className="eyebrow tabular text-white/70">
              {counter(openIndex!)}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label={labels.close}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-[var(--motion-fast)] hover:bg-white/15"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-2 pb-2">
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label={labels.previous}
                className="absolute left-2 z-10 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] border border-white/25 bg-court/70 text-white transition-colors duration-[var(--motion-fast)] hover:border-white hover:bg-court"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
            )}
            <div className="relative h-full w-full max-w-6xl">
              <Image
                key={active.key}
                src={active.fullUrl}
                alt={active.alt}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => move(1)}
                aria-label={labels.next}
                className="absolute right-2 z-10 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] border border-white/25 bg-court/70 text-white transition-colors duration-[var(--motion-fast)] hover:border-white hover:bg-court"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {(active.caption || active.alt) && (
            <p className="mx-auto max-w-[60ch] px-4 pb-6 text-center text-[length:var(--text-sm)] text-white/80">
              {active.caption || active.alt}
            </p>
          )}
        </div>
      )}
    </>
  );
}
