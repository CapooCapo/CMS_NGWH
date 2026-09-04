"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui";

export type HeroSlide = {
  key: string;
  headline: string | null;
  subheadline: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  posterAlt: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

/**
 * REQ-HOME-001 — hero video carousel. OQ-003 closed in favour of video, so a
 * clip plays where one is supplied and the poster image is the fallback.
 *
 * The hero is the page's thesis, so it opens on the most characteristic thing
 * the organization has: a game in motion, with the tagline set as an eyebrow
 * above a heavy display headline. It is sized to its content rather than the
 * viewport, so the sections below stay in the first frame.
 *
 * Deliberate behaviour:
 *  - videos are muted/inline/loop, the only way mobile browsers allow autoplay;
 *  - `prefers-reduced-motion` disables autoplay *and* auto-advance, leaving a
 *    still poster the visitor pages through manually;
 *  - a clip that fails to load flips that slide to its poster rather than
 *    showing a black rectangle;
 *  - auto-advance pauses on hover/focus so it cannot pull a CTA out from under
 *    the pointer or keyboard focus.
 */
const SLIDE_MS = 7000;

export function HeroCarousel({
  slides,
  tagline,
  labels,
}: {
  slides: readonly HeroSlide[];
  tagline: string;
  labels: { previous: string; next: string; slideOf: string };
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const count = slides.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count]
  );

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const timer = window.setTimeout(() => go(1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, paused, reducedMotion, go]);

  // Only the visible slide's video should be playing.
  useEffect(() => {
    slides.forEach((slide, i) => {
      const video = videoRefs.current[slide.key];
      if (!video) return;
      if (i === index && !reducedMotion) {
        video.play().catch(() => {
          // Autoplay refusal is not worth surfacing; the poster shows.
        });
      } else {
        video.pause();
      }
    });
  }, [index, reducedMotion, slides]);

  if (count === 0) return null;
  const active = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={tagline}
      className="on-court relative isolate overflow-hidden bg-ink text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative h-[30rem] w-full sm:h-[34rem] lg:h-[38rem]">
        {slides.map((slide, i) => {
          const isActive = i === index;
          const useVideo = slide.videoUrl && !failed[slide.key] && !reducedMotion;
          return (
            <div
              key={slide.key}
              aria-hidden={!isActive}
              className={`absolute inset-0 transition-opacity duration-700 ease-[var(--ease)] ${
                isActive ? "opacity-100" : "opacity-0"
              }`}
            >
              {slide.posterUrl && (
                <Image
                  src={slide.posterUrl}
                  alt={isActive ? (slide.posterAlt ?? "") : ""}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover"
                />
              )}
              {useVideo && (
                <video
                  ref={(el) => {
                    videoRefs.current[slide.key] = el;
                  }}
                  src={slide.videoUrl ?? undefined}
                  poster={slide.posterUrl ?? undefined}
                  muted
                  loop
                  playsInline
                  preload={i === 0 ? "auto" : "none"}
                  aria-hidden="true"
                  tabIndex={-1}
                  onError={() => setFailed((prev) => ({ ...prev, [slide.key]: true }))}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>
          );
        })}

        {/*
          Two-part scrim: a vertical wash for overall legibility plus a
          left-weighted one, because the copy is left-aligned. Keeps the
          headline well clear of AA over any footage.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-court via-court/60 to-court/25"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-court/85 via-court/35 to-transparent"
        />

        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 sm:pb-12 lg:px-8 lg:pb-14">
            <p className="eyebrow mb-3 text-accent">{tagline}</p>
            {/* aria-live so paging the carousel announces the new slide. */}
            <div aria-live="polite" aria-atomic="true">
              {active.headline && (
                <h1 className="max-w-[22ch] text-[length:var(--text-hero)] font-black leading-[0.95]">
                  {active.headline}
                </h1>
              )}
              {active.subheadline && (
                <p className="mt-4 max-w-[46ch] text-[length:var(--text-base)] leading-relaxed text-white/85 sm:text-[length:var(--text-lg)]">
                  {active.subheadline}
                </p>
              )}
            </div>
            {active.ctaLabel && active.ctaHref && (
              <div className="mt-7">
                <Link href={active.ctaHref} className={buttonClass("accent", "", "lg")}>
                  {active.ctaLabel}
                </Link>
              </div>
            )}

            {count > 1 && (
              <div className="mt-8 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label={labels.previous}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-white/30 text-white transition-colors duration-[var(--motion-fast)] hover:border-white hover:bg-white/15"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M15 5l-7 7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label={labels.next}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-white/30 text-white transition-colors duration-[var(--motion-fast)] hover:border-white hover:bg-white/15"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                {/* Progress reads as court markings rather than dots. */}
                <ul className="flex items-center gap-1.5">
                  {slides.map((slide, i) => (
                    <li key={slide.key}>
                      <button
                        type="button"
                        onClick={() => setIndex(i)}
                        aria-current={i === index ? "true" : undefined}
                        aria-label={labels.slideOf
                          .replace("{index}", String(i + 1))
                          .replace("{total}", String(count))}
                        className={`h-[3px] transition-all duration-[var(--motion-base)] ease-[var(--ease)] ${
                          i === index ? "w-10 bg-accent" : "w-5 bg-white/40 hover:bg-white/70"
                        }`}
                      />
                    </li>
                  ))}
                </ul>
                <span className="eyebrow tabular text-white/60">
                  {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
