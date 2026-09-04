import { getLocale, getTranslations } from "next-intl/server";
import { getLiveAndResults } from "@/server/repositories/matches";
import { MatchList, type MatchLabels } from "@/components/matches/MatchRow";
import { ActionLink, EmptyState, ErrorState, Eyebrow, SectionHeading } from "@/components/ui";

export async function matchLabels(): Promise<MatchLabels> {
  const t = await getTranslations("tournaments");
  return {
    scheduled: t("matchStatusScheduled"),
    live: t("matchStatusLive"),
    completed: t("matchStatusCompleted"),
    postponed: t("matchStatusPostponed"),
    cancelled: t("matchStatusCancelled"),
    venue: t("venue"),
    period: t("period"),
    fouls: t("fouls"),
  };
}

/**
 * REQ-HOME-005 — "Live & Results" quick scoreboard.
 *
 * OQ-004 (closed 2026-08-20): show a live match first; when nothing is live,
 * show the most recently finished match. Upcoming fixtures are only used when
 * there is neither, so the widget still says something before a season starts.
 *
 * Reads the application database (OQ-005, closed: use the existing match DB),
 * and returns an error panel rather than throwing, so a database outage
 * degrades this one section instead of the whole homepage.
 */
export async function LiveResults() {
  const [locale, t, common, labels] = await Promise.all([
    getLocale(),
    getTranslations("home"),
    getTranslations("common"),
    matchLabels(),
  ]);

  let data: Awaited<ReturnType<typeof getLiveAndResults>>;
  try {
    data = await getLiveAndResults(4);
  } catch {
    return (
      <section aria-labelledby="live-results">
        <SectionHeading id="live-results" eyebrow={t("liveResultsEyebrow")}>
          {t("liveResults")}
        </SectionHeading>
        <ErrorState title={common("error")} body={common("errorBody")} />
      </section>
    );
  }

  const primary = data.live.length > 0 ? data.live : data.recent;
  const heading = data.live.length > 0 ? t("liveNow") : t("recentResults");
  const fallback = primary.length === 0 ? data.upcoming : [];

  return (
    <section aria-labelledby="live-results">
      <SectionHeading
        id="live-results"
        eyebrow={t("liveResultsEyebrow")}
        action={<ActionLink href="/tournaments">{t("fullSchedule")}</ActionLink>}
      >
        {t("liveResults")}
      </SectionHeading>

      {primary.length === 0 && fallback.length === 0 ? (
        <EmptyState title={t("noMatches")} />
      ) : (
        <div className="flex flex-col gap-3">
          <Eyebrow tone="muted" className="!text-muted">
            {primary.length > 0 ? heading : t("upcoming")}
          </Eyebrow>
          <MatchList
            matches={primary.length > 0 ? primary : fallback}
            locale={locale}
            labels={labels}
          />
        </div>
      )}
    </section>
  );
}
