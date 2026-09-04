import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MatchList } from "@/components/matches/MatchRow";
import { matchLabels } from "@/components/home/LiveResults";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  SectionHeading,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatWinPct } from "@/lib/format";
import {
  listMatchesBySeason,
  listResultsBySeason,
} from "@/server/repositories/matches";
import { computeStandings } from "@/server/services/standings";
import { topAssists, topScorers } from "@/server/repositories/stats";
import type { Season, StatLeader } from "@/server/repositories/types";

export async function seasonStatusLabel(status: Season["status"]) {
  const t = await getTranslations("tournaments");
  return {
    upcoming: t("statusUpcoming"),
    active: t("statusActive"),
    completed: t("statusCompleted"),
  }[status];
}

function LeaderTable({
  title,
  rows,
  valueHeading,
  labels,
}: {
  title: string;
  rows: readonly StatLeader[];
  valueHeading: string;
  labels: { player: string; club: string; games: string; empty: string };
}) {
  return (
    // `min-w-0` matters: this sits in a CSS grid, and a grid item defaults to
    // `min-width: auto`, so the table's own min-width would widen the track and
    // push the page sideways instead of letting the wrapper scroll.
    <div className="min-w-0">
      <h3 className="eyebrow mb-3 text-muted">{title}</h3>
      {rows.length === 0 ? (
        <EmptyState title={labels.empty} />
      ) : (
        <Table
          caption={title}
          minWidth="26rem"
          head={
            <>
              <Th align="right" className="w-10">
                #
              </Th>
              <Th sticky>{labels.player}</Th>
              <Th>{labels.club}</Th>
              <Th align="right" title={labels.games}>
                {labels.games}
              </Th>
              <Th align="right">{valueHeading}</Th>
            </>
          }
        >
          {rows.map((row, i) => (
            <tr
              key={`${row.player_name}-${row.club_id ?? "none"}`}
              className="transition-colors duration-[var(--motion-fast)] hover:bg-surface-sunken"
            >
              <Td align="right" numeric className="text-muted">
                {i + 1}
              </Td>
              <Td header sticky>
                {row.player_name}
              </Td>
              <Td className="text-muted">
                {row.club_slug ? (
                  <Link href={`/clubs/${row.club_slug}`} className="hover:text-brand-text hover:underline">
                    {row.club_name}
                  </Link>
                ) : (
                  (row.club_name ?? "—")
                )}
              </Td>
              <Td align="right" numeric className="text-muted">
                {row.games}
              </Td>
              <Td align="right" numeric strong className="font-display">
                {row.total}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/**
 * One season's schedule, standings, results and statistics.
 *
 * Shared by `/tournaments` (current season) and `/tournaments/[slug]` so both
 * render identically. Every database read is wrapped: if PostgreSQL is
 * unreachable the section shows an error panel instead of failing the route.
 */
export async function SeasonView({ season }: { season: Season }) {
  const locale = await getLocale();
  const [t, common, labels] = await Promise.all([
    getTranslations("tournaments"),
    getTranslations("common"),
    matchLabels(),
  ]);

  let schedule = [] as Awaited<ReturnType<typeof listMatchesBySeason>>;
  let results = [] as Awaited<ReturnType<typeof listResultsBySeason>>;
  let standings = [] as Awaited<ReturnType<typeof computeStandings>>;
  let scorers: StatLeader[] = [];
  let assisters: StatLeader[] = [];
  let failed = false;

  try {
    [schedule, results, standings, scorers, assisters] = await Promise.all([
      listMatchesBySeason(season.id),
      listResultsBySeason(season.id),
      computeStandings(season.id),
      topScorers(season.id, 10),
      topAssists(season.id, 10),
    ]);
  } catch {
    failed = true;
  }

  if (failed) {
    return <ErrorState title={common("error")} body={common("errorBody")} />;
  }

  // Fixtures that have not been played yet, for the schedule view.
  const upcoming = schedule.filter(
    (match) => match.status !== "completed" && match.status !== "cancelled"
  );

  const statLabels = {
    player: t("player"),
    club: t("club"),
    games: t("games"),
    empty: t("noStats"),
  };

  return (
    <div className="flex flex-col gap-14">
      {/* REQ-TOURN-001 — match schedule by date and time. */}
      <section aria-labelledby="schedule">
        <SectionHeading id="schedule">{t("schedule")}</SectionHeading>
        {upcoming.length === 0 ? (
          <EmptyState title={t("noSchedule")} />
        ) : (
          <MatchList matches={upcoming} locale={locale} labels={labels} />
        )}
      </section>

      {/* REQ-TOURN-002 — standings, derived from completed results. */}
      <section aria-labelledby="standings">
        <SectionHeading id="standings">{t("standings")}</SectionHeading>
        {standings.length === 0 ? (
          <EmptyState title={t("noStandings")} />
        ) : (
          <Table
            caption={t("standings")}
            minWidth="44rem"
            note={t("standingsNote")}
            head={
              <>
                <Th align="right" className="w-10">
                  #
                </Th>
                <Th sticky>{t("team")}</Th>
                <Th align="right" title={t("games")}>
                  {t("played")}
                </Th>
                <Th align="right" title={t("wins")}>
                  {t("wins")}
                </Th>
                <Th align="right" title={t("losses")}>
                  {t("losses")}
                </Th>
                <Th align="right">{t("winPct")}</Th>
                <Th align="right" title={t("pointsFor")}>
                  {t("pointsFor")}
                </Th>
                <Th align="right" title={t("pointsAgainst")}>
                  {t("pointsAgainst")}
                </Th>
                <Th align="right">{t("pointDiff")}</Th>
              </>
            }
          >
            {standings.map((row, i) => (
              <tr
                key={`${row.club_id ?? row.team_name}`}
                className="transition-colors duration-[var(--motion-fast)] hover:bg-surface-sunken"
              >
                <Td align="right" numeric className="text-muted">
                  {/* Leader carries a gold marker rather than a coloured row. */}
                  {i === 0 ? (
                    <span className="inline-flex items-center gap-1 font-bold text-accent-strong">
                      <span aria-hidden="true">▲</span>1
                    </span>
                  ) : (
                    i + 1
                  )}
                </Td>
                <Td header sticky>
                  {row.club_slug ? (
                    <Link
                      href={`/clubs/${row.club_slug}`}
                      className="hover:text-brand-text hover:underline"
                    >
                      {row.team_name}
                    </Link>
                  ) : (
                    row.team_name
                  )}
                </Td>
                <Td align="right" numeric className="text-muted">
                  {row.played}
                </Td>
                <Td align="right" numeric strong>
                  {row.wins}
                </Td>
                <Td align="right" numeric className="text-muted">
                  {row.losses}
                </Td>
                <Td align="right" numeric>
                  {formatWinPct(row.win_pct)}
                </Td>
                <Td align="right" numeric className="text-muted">
                  {row.points_for}
                </Td>
                <Td align="right" numeric className="text-muted">
                  {row.points_against}
                </Td>
                <Td
                  align="right"
                  numeric
                  className={row.point_diff > 0 ? "text-success-text" : row.point_diff < 0 ? "text-muted" : ""}
                >
                  {row.point_diff > 0 ? `+${row.point_diff}` : row.point_diff}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {/* Results. */}
      <section aria-labelledby="results">
        <SectionHeading id="results">{t("results")}</SectionHeading>
        {results.length === 0 ? (
          <EmptyState title={t("noResults")} />
        ) : (
          <MatchList matches={results} locale={locale} labels={labels} />
        )}
      </section>

      {/* REQ-TOURN-003 — only the two categories the requirement names. */}
      <section aria-labelledby="statistics">
        <SectionHeading id="statistics">{t("statistics")}</SectionHeading>
        <div className="grid gap-8 lg:grid-cols-2">
          <LeaderTable
            title={t("topScorers")}
            rows={scorers}
            valueHeading={t("points")}
            labels={statLabels}
          />
          <LeaderTable
            title={t("topAssists")}
            rows={assisters}
            valueHeading={t("assists")}
            labels={statLabels}
          />
        </div>
        <p className="mt-3 text-xs text-muted">{t("statsNote")}</p>
      </section>
    </div>
  );
}

/** Season switcher + REQ-TOURN-004 archive list. */
export async function SeasonNav({
  seasons,
  activeSlug,
}: {
  seasons: readonly Season[];
  activeSlug: string | null;
}) {
  const locale = await getLocale();
  const t = await getTranslations("tournaments");

  return (
    <nav aria-label={t("seasons")} className="mb-8">
      <ul className="flex flex-wrap gap-2">
        {seasons.map((season) => {
          const active = season.slug === activeSlug;
          const name = locale === "vi" ? season.name_vi : season.name_en;
          return (
            <li key={season.id}>
              <Link
                href={`/tournaments/${season.slug}`}
                aria-current={active ? "true" : undefined}
                className={`inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border px-4 text-[length:var(--text-sm)] font-semibold transition-colors duration-[var(--motion-fast)] ${
                  active
                    ? "border-brand bg-brand text-brand-contrast"
                    : "border-border-strong text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                {name}
                {season.status === "active" && (
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      active ? "bg-white" : "bg-success"
                    }`}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { Badge, Card };
