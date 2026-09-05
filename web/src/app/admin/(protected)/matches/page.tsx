import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { ScoreConsole } from "@/components/admin/ScoreConsole";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { listClubs } from "@/server/repositories/clubs";
import { listAdminMatches, listLiveMatches } from "@/server/repositories/matches";
import { listSeasons } from "@/server/repositories/seasons";
import { currentAdmin } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const [metaT, t] = await Promise.all([
    getTranslations("admin.meta"),
    getTranslations("admin.matches"),
  ]);
  return {
    title: metaT("matches"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

/**
 * REQ-TOURN-001 fixture management plus the live scoreboard console.
 *
 * Live matches are hoisted to the top with their consoles open, because during
 * a game that is the only thing the operator needs. Creating and deleting
 * fixtures is `editor`/`admin`; score updates are also open to `operator`.
 */
export default async function AdminMatchesPage({
  searchParams,
}: PageProps<"/admin/matches">) {
  const [admin, locale, t, statusT, actionsT] = await Promise.all([
    currentAdmin(),
    getLocale(),
    getTranslations("admin.matches"),
    getTranslations("admin.status"),
    getTranslations("admin.actions"),
  ]);
  const params = await searchParams;
  const page = parsePage(params.page);
  const rawScoreboard = Array.isArray(params.scoreboard) ? params.scoreboard[0] : params.scoreboard;
  const selectedScoreboardId = rawScoreboard ? Number.parseInt(rawScoreboard, 10) : null;

  let matches, seasons, clubs, live;
  try {
    [matches, seasons, clubs, live] = await Promise.all([
      listAdminMatches(page),
      listSeasons(),
      listClubs({ approvedOnly: false, limit: 100 }),
      listLiveMatches(),
    ]);
  } catch (error) {
    console.error("admin matches", error);
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState title={t("databaseUnavailable")} />
      </>
    );
  }

  const seasonOptions = seasons.map((season) => ({
    value: String(season.id),
    label: locale === "vi" ? season.name_vi : season.name_en,
  }));
  const clubOptions = clubs.rows.map((club) => ({
    value: String(club.id),
    label: club.name,
  }));
  // `superadmin` and `admin` are supersets of every business role (see
  // server/auth/permissions), so both get the editor affordances here. The
  // API re-checks this regardless of what the page renders.
  const canEdit =
    admin?.role === "superadmin" || admin?.role === "admin" || admin?.role === "editor";
  const hrefForScoreboard = (id: number) => {
    const query = new URLSearchParams();
    if (matches.page > 1) query.set("page", String(matches.page));
    if (selectedScoreboardId !== id) query.set("scoreboard", String(id));
    const suffix = query.toString();
    return `/admin/matches${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
      />

      {live.length > 0 && (
        <section aria-labelledby="live-consoles" className="mb-8">
          <h2
            id="live-consoles"
            className="eyebrow mb-3 flex items-center gap-2 text-muted"
          >
            {t("liveNow")}
            <Badge tone="live">{live.length}</Badge>
          </h2>
          <ul className="flex flex-col gap-3">
            {live.map((match) => (
              <li key={match.id}>
                <ScoreConsole match={match} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <div className="mb-6">
          <Disclosure label={t("add")}>
            {seasons.length === 0 ? (
              <p className="text-[length:var(--text-sm)] text-muted">
                {t("createSeasonFirst")}
              </p>
            ) : (
              <JsonForm
                action="/api/admin/matches"
                submitLabel={t("create")}
                fields={[
                  {
                    name: "seasonId",
                    label: t("season"),
                    type: "select",
                    required: true,
                    options: seasonOptions,
                  },
                  {
                    name: "scheduledAt",
                    label: t("tipOff"),
                    type: "datetime-local",
                    required: true,
                  },
                  { name: "homeTeamName", label: t("homeTeamName"), required: true },
                  { name: "awayTeamName", label: t("awayTeamName"), required: true },
                  {
                    name: "homeClubId",
                    label: t("homeClub"),
                    type: "select",
                    options: clubOptions,
                    hint: t("clubHint"),
                  },
                  {
                    name: "awayClubId",
                    label: t("awayClub"),
                    type: "select",
                    options: clubOptions,
                  },
                  { name: "venue", label: t("venue") },
                  {
                    name: "status",
                    label: t("status"),
                    type: "select",
                    required: true,
                    defaultValue: "scheduled",
                    options: [
                      { value: "scheduled", label: statusT("scheduled") },
                      { value: "live", label: statusT("live") },
                      { value: "completed", label: statusT("completed") },
                      { value: "postponed", label: statusT("postponed") },
                      { value: "cancelled", label: statusT("cancelled") },
                    ],
                  },
                  { name: "homeScore", label: t("homeScore"), type: "number", min: 0, max: 500 },
                  { name: "awayScore", label: t("awayScore"), type: "number", min: 0, max: 500 },
                ]}
              />
            )}
          </Disclosure>
        </div>
      )}

      {matches.rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <>
          <Table
            caption={t("tableCaption")}
            minWidth="58rem"
            head={<><Th sticky>{t("fixture")}</Th><Th>{t("season")}</Th><Th>{t("tipOff")}</Th><Th>{t("status")}</Th><Th align="right">{t("score")}</Th><Th align="right">{t("actions")}</Th></>}
          >
            {matches.rows.map((match) => {
              const selected = selectedScoreboardId === match.id && match.status !== "live";
              return (
                <Fragment key={match.id}>
                  <tr className={selected ? "bg-accent/10" : "hover:bg-surface-sunken"}>
                    <Td header sticky><span className="block">{match.home_team_name} vs {match.away_team_name}</span>{match.venue && <span className="block text-[length:var(--text-xs)] font-normal text-muted">{match.venue}</span>}</Td>
                    <Td>{locale === "vi" ? match.season_name_vi : match.season_name_en}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(match.scheduled_at, locale) ?? "—"}</Td>
                    <Td><Badge tone={match.status === "live" ? "live" : "neutral"}>{statusT(match.status)}</Badge></Td>
                    <Td align="right" numeric strong className="font-display">{match.status === "live" || match.status === "completed" ? `${match.home_score}–${match.away_score}` : "—"}</Td>
                    <Td align="right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/admin/matches/${match.id}`} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{actionsT("stats")}</Link>
                        {match.status !== "live" && <Link href={hrefForScoreboard(match.id)} aria-expanded={selected} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{selected ? t("closeScoreboard") : t("scoreboard")}</Link>}
                        {(admin?.role === "superadmin" || admin?.role === "admin") && <ToggleButton action={`/api/admin/matches/${match.id}`} method="DELETE" label={actionsT("delete")} tone="dangerGhost" confirm={t("deleteConfirm")} />}
                      </div>
                    </Td>
                  </tr>
                  {selected && <tr className="bg-surface-sunken/45"><Td colSpan={6}><ScoreConsole match={match} /></Td></tr>}
                </Fragment>
              );
            })}
          </Table>
          <AdminPagination basePath="/admin/matches" pagination={matches} searchParams={{}} />
        </>
      )}
    </>
  );
}
