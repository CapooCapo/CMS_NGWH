import Link from "next/link";
import { ClubCrest } from "@/components/clubs/ClubCrest";
import type { MatchStatus, MatchWithContext } from "@/server/repositories/types";
import { formatDateShort, formatTime, isoDate } from "@/lib/format";
import { Badge, LiveBadge } from "@/components/ui";

export type MatchLabels = {
  scheduled: string;
  live: string;
  completed: string;
  postponed: string;
  cancelled: string;
  venue: string;
  period: string;
  fouls: string;
};

export function matchStatusLabel(status: MatchStatus, labels: MatchLabels): string {
  return labels[status];
}

/**
 * One fixture or result.
 *
 * Laid out as a real scoreboard line: team — figure — team, with the score in
 * the display face at tabular width so a column of rows keeps its digits in
 * line. The winning side is marked by weight rather than colour, so the
 * distinction survives greyscale and low vision.
 *
 * Below `sm` the row restacks: status and kick-off move to their own line
 * above the matchup, because squeezing five columns onto a phone is what made
 * the previous version overflow. Nothing here uses a fixed non-shrinking
 * width — every track can shrink and truncate.
 */
function TeamSide({
  name,
  slug,
  logo,
  score,
  fouls,
  showScore,
  showFouls,
  won,
  align = "left",
}: {
  name: string;
  slug: string | null;
  logo: string | null;
  score: number;
  fouls: number;
  showScore: boolean;
  showFouls: boolean;
  won: boolean;
  align?: "left" | "right";
}) {
  const label = slug ? (
    <Link
      href={`/clubs/${slug}`}
      className="transition-colors duration-[var(--motion-fast)] hover:text-brand-text hover:underline"
    >
      {name}
    </Link>
  ) : (
    name
  );
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2.5 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <ClubCrest name={name} logoUrl={logo} size={32} rounded="full" />
      <div className="min-w-0 flex-1">
        <span
          className={`block truncate text-[length:var(--text-sm)] ${
            won ? "font-bold" : "font-medium"
          }`}
        >
          {label}
        </span>
        {showFouls && (
          <span
            className={`mt-1 flex gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}
            aria-label={`${fouls} team fouls`}
          >
            {Array.from({ length: Math.max(1, fouls) }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={
                  fouls === 0
                    ? "h-2 w-2 rounded-full border border-muted"
                    : "h-2 w-2 rounded-full bg-live"
                }
              />
            ))}
          </span>
        )}
      </div>
      {showScore && (
        <span
          className={`font-display tabular shrink-0 text-[length:var(--text-xl)] leading-none ${
            won ? "font-black" : "font-bold text-muted"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

export function MatchRow({
  match,
  locale,
  labels,
  showDate = true,
}: {
  match: MatchWithContext;
  locale: string;
  labels: MatchLabels;
  showDate?: boolean;
}) {
  const decided = match.status === "live" || match.status === "completed";
  const homeWon = match.status === "completed" && match.home_score > match.away_score;
  const awayWon = match.status === "completed" && match.away_score > match.home_score;
  const isLive = match.status === "live";

  return (
    <div
      className={`flex flex-col gap-3 px-4 py-3.5 transition-colors duration-[var(--motion-fast)] sm:flex-row sm:items-center sm:gap-4 ${
        isLive ? "bg-live/[0.04]" : "hover:bg-surface-sunken"
      }`}
    >
      {/* Status + kick-off. Own line on phones, a narrow column from sm up. */}
      <div className="flex items-center gap-2.5 sm:w-28 sm:shrink-0 sm:flex-col sm:items-start sm:gap-1.5">
        {isLive ? (
          <LiveBadge label={labels.live} />
        ) : (
          <Badge tone={match.status === "completed" ? "neutral" : "muted"}>
            {matchStatusLabel(match.status, labels)}
          </Badge>
        )}
        {showDate && (
          <time
            dateTime={isoDate(match.scheduled_at)}
            className="tabular text-[length:var(--text-xs)] text-muted"
          >
            {formatDateShort(match.scheduled_at, locale)}
          </time>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <TeamSide
          name={match.home_team_name}
          slug={match.home_club_slug}
          logo={match.home_club_logo}
          score={match.home_score}
          fouls={match.home_fouls}
          showScore={decided}
          showFouls={isLive}
          won={homeWon}
        />
        <span
          aria-hidden="true"
          className="tabular shrink-0 text-[length:var(--text-xs)] font-semibold text-muted"
        >
          {decided ? "–" : formatTime(match.scheduled_at, locale)}
        </span>
        <TeamSide
          name={match.away_team_name}
          slug={match.away_club_slug}
          logo={match.away_club_logo}
          score={match.away_score}
          fouls={match.away_fouls}
          showScore={decided}
          showFouls={isLive}
          won={awayWon}
          align="right"
        />
      </div>

      <div className="min-w-0 text-[length:var(--text-xs)] text-muted sm:w-28 sm:shrink-0 sm:text-right lg:w-36">
        {isLive && match.period && (
          <span className="eyebrow block truncate text-live-text">
            {labels.period} {match.period}
          </span>
        )}
        {!isLive && match.venue && <span className="block truncate">{match.venue}</span>}
      </div>
    </div>
  );
}

/** Rule-separated list — no card per row, so a schedule reads as one object. */
export function MatchList({
  matches,
  locale,
  labels,
  showDate = true,
}: {
  matches: readonly MatchWithContext[];
  locale: string;
  labels: MatchLabels;
  showDate?: boolean;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface">
      {matches.map((match) => (
        <li key={match.id}>
          <MatchRow match={match} locale={locale} labels={labels} showDate={showDate} />
        </li>
      ))}
    </ul>
  );
}
