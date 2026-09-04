import type { MatchWithContext } from "@/server/repositories/types";

export type LiveFeed = {
  live: MatchWithContext[];
  recent: MatchWithContext[];
  upcoming: MatchWithContext[];
  fetchedAt: string;
};

/** The public live page and its JSON resync endpoint both request eight rows. */
export const LIVE_FEED_LIMIT = 8;

export function shouldApplyLiveRevision(current: number | undefined, incoming: number) {
  return incoming > (current ?? -1);
}

function byScheduledAscending(a: MatchWithContext, b: MatchWithContext) {
  return a.scheduled_at.localeCompare(b.scheduled_at) || a.id - b.id;
}

function byScheduledDescending(a: MatchWithContext, b: MatchWithContext) {
  return byScheduledAscending(b, a);
}

function replaceInList(
  matches: MatchWithContext[],
  match: MatchWithContext,
  include: boolean,
  sort: (a: MatchWithContext, b: MatchWithContext) => number
) {
  const withoutMatch = matches.filter((item) => item.id !== match.id);
  return (include ? [...withoutMatch, match] : withoutMatch)
    .sort(sort)
    .slice(0, LIVE_FEED_LIMIT);
}

/**
 * Applies one authoritative match snapshot without fetching or refreshing the
 * route. A status transition moves only that match between the three feeds.
 */
export function applyLiveMatchUpdate(feed: LiveFeed, match: MatchWithContext): LiveFeed {
  const isUpcoming =
    match.status === "scheduled" && new Date(match.scheduled_at).getTime() >= Date.now();
  return {
    ...feed,
    live: replaceInList(feed.live, match, match.status === "live", byScheduledAscending),
    recent: replaceInList(
      feed.recent,
      match,
      match.status === "completed",
      byScheduledDescending
    ),
    upcoming: replaceInList(feed.upcoming, match, isUpcoming, byScheduledAscending),
    fetchedAt: new Date().toISOString(),
  };
}
