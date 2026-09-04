"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MatchWithContext } from "@/server/repositories/types";
import {
  applyLiveMatchUpdate,
  shouldApplyLiveRevision,
  type LiveFeed,
} from "@/lib/liveFeed";
import { MatchList, type MatchLabels } from "./MatchRow";
import { EmptyState, SectionHeading } from "@/components/ui";

type Feed = LiveFeed;

type MatchUpdatedEvent = {
  type: "match.updated";
  eventId: string;
  matchId: number;
  revision: number;
  match: MatchWithContext;
};

/**
 * Public live scoreboard.
 *
 * The initial data is server-rendered. Thereafter one SSE stream applies only
 * the affected match; a reconnect fetches the ordinary JSON feed to recover
 * any notifications missed while the browser was offline.
 */

export function LiveScoreboard({
  initial,
  labels,
}: {
  initial: Feed;
  labels: MatchLabels;
}) {
  const locale = useLocale();
  const t = useTranslations("live");
  const home = useTranslations("home");
  const [feed, setFeed] = useState<Feed>(initial);
  const [connection, setConnection] = useState<"live" | "reconnecting">("reconnecting");
  const revisions = useRef(new Map<number, number>());

  function recordFeedRevisions(next: Feed) {
    revisions.current = new Map(
      [...next.live, ...next.recent, ...next.upcoming].map((match) => [
        match.id,
        match.live_revision,
      ])
    );
  }

  function applyEvent(event: MatchUpdatedEvent) {
    if (!shouldApplyLiveRevision(revisions.current.get(event.matchId), event.revision)) return;
    revisions.current.set(event.matchId, event.revision);
    setFeed((current) => applyLiveMatchUpdate(current, event.match));
  }

  useEffect(() => {
    recordFeedRevisions(initial);
    let cancelled = false;
    let resyncing = false;
    const queued: MatchUpdatedEvent[] = [];

    const resync = async () => {
      if (resyncing) return;
      resyncing = true;
      setConnection("reconnecting");
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as Feed;
        if (!cancelled) {
          recordFeedRevisions(data);
          setFeed(data);
          for (const event of queued.splice(0)) applyEvent(event);
          setConnection("live");
        }
      } catch {
        // EventSource retries on its own. Keep the last known scoreboard while
        // waiting for the next open event instead of blanking the board.
        if (!cancelled) setConnection("reconnecting");
      } finally {
        resyncing = false;
      }
    };

    const source = new EventSource("/api/live/events");
    source.addEventListener("match.updated", (message) => {
      try {
        const event = JSON.parse((message as MessageEvent<string>).data) as MatchUpdatedEvent;
        if (
          event.type !== "match.updated" ||
          !Number.isSafeInteger(event.matchId) ||
          !Number.isSafeInteger(event.revision)
        ) return;
        if (resyncing) queued.push(event);
        else applyEvent(event);
      } catch {
        // Ignore an invalid transport message; the next resync is authoritative.
      }
    });
    source.onopen = () => void resync();
    source.onerror = () => setConnection("reconnecting");

    return () => {
      cancelled = true;
      source.close();
    };
  // `initial` is the server snapshot for this mounted page. Reconnecting is
  // driven by EventSource; resubscribing on ordinary parent renders is wrong.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updated = new Date(feed.fetchedAt);
  const updatedLabel = Number.isNaN(updated.getTime())
    ? null
    : new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(updated);

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="live-now">
        <SectionHeading id="live-now">{home("liveNow")}</SectionHeading>
        {/* Score changes are announced politely rather than assertively so a
            screen-reader user is not interrupted mid-sentence. */}
        <div aria-live="polite" aria-atomic="false">
          {feed.live.length === 0 ? (
            <EmptyState title={t("noLive")} />
          ) : (
            <MatchList matches={feed.live} locale={locale} labels={labels} />
          )}
        </div>
        {/* Freshness indicator: amber while EventSource is reconnecting. */}
        <p
          className={`mt-2.5 flex items-center gap-1.5 text-[length:var(--text-xs)] ${
            connection === "reconnecting" ? "font-semibold text-warning-text" : "text-muted"
          }`}
        >
          {connection === "reconnecting" && (
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 3.5-.2 5h-1.1l-.2-5h1.5ZM8 11.1a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" />
            </svg>
          )}
          {connection === "reconnecting"
            ? t("connectionReconnecting")
            : updatedLabel
              ? t("updated", { time: updatedLabel })
              : t("connectionLive")}
        </p>
      </section>

      {feed.recent.length > 0 && (
        <section aria-labelledby="recent-results">
          <SectionHeading id="recent-results">{home("recentResults")}</SectionHeading>
          <MatchList matches={feed.recent} locale={locale} labels={labels} />
        </section>
      )}

      {feed.upcoming.length > 0 && (
        <section aria-labelledby="upcoming-fixtures">
          <SectionHeading id="upcoming-fixtures">{home("upcoming")}</SectionHeading>
          <MatchList matches={feed.upcoming} locale={locale} labels={labels} />
        </section>
      )}
    </div>
  );
}
