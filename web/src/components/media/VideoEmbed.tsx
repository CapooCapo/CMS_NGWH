"use client";

import Image from "next/image";
import { useState } from "react";
import { toVideoEmbed } from "@/lib/videoEmbed";

type VideoEmbedProps = {
  title: string;
  description?: string | null;
  sourceLabel?: string | null;
  thumbnailUrl?: string | null;
  thumbnailAlt?: string | null;
  videoUrl: string;
  playLabel: string;
};

/**
 * A click-to-play embed: the poster is the initial, fast page surface and the
 * external player only mounts after the visitor deliberately asks for it.
 */
export function VideoEmbed({
  title,
  description,
  sourceLabel,
  thumbnailUrl,
  thumbnailAlt,
  videoUrl,
  playLabel,
}: VideoEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const video = toVideoEmbed(videoUrl);

  if (!video) return null;

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="relative aspect-video bg-ink">
        {playing ? (
          <iframe
            src={video.src}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${playLabel}: ${title}`}
            className="group absolute inset-0 isolate block h-full w-full overflow-hidden bg-ink text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
          >
            {thumbnailUrl && (
              <Image
                src={thumbnailUrl}
                alt={thumbnailAlt ?? ""}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            )}
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-court/90 via-court/20 to-transparent" />
            <span className="absolute left-5 top-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-court shadow-lg transition-transform duration-200 group-hover:scale-105">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor">
                <path d="M8 5.5v13l10-6.5-10-6.5Z" />
              </svg>
            </span>
            <span className="absolute inset-x-5 bottom-5 text-[length:var(--text-sm)] font-bold text-white">
              {playLabel}
            </span>
          </button>
        )}
      </div>
      <div className="p-5 sm:p-6">
        {sourceLabel && <p className="eyebrow mb-2 text-accent-strong">{sourceLabel}</p>}
        <h3 className="text-[length:var(--text-xl)] font-extrabold leading-tight">{title}</h3>
        {description && <p className="mt-3 text-[length:var(--text-sm)] leading-relaxed text-muted">{description}</p>}
      </div>
    </article>
  );
}
