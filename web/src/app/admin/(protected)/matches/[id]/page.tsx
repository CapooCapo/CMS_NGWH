import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { JsonForm } from "@/components/admin/JsonForm";
import { ScoreConsole } from "@/components/admin/ScoreConsole";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Card, EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { listClubs } from "@/server/repositories/clubs";
import { findMatchById } from "@/server/repositories/matches";
import { listMatchStats } from "@/server/repositories/stats";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const [metaT, t] = await Promise.all([
    getTranslations("admin.meta"),
    getTranslations("admin.matchDetail"),
  ]);
  return {
    title: metaT("matchDetail"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  };
}

/**
 * Per-match statistics entry (REQ-TOURN-003).
 *
 * Only points and assists are recorded — those are the two categories the
 * requirement names, and OQ-008 (the full category list) is still Open, so no
 * further columns are invented here.
 */
export default async function AdminMatchDetailPage({
  params,
}: PageProps) {
  const [t, metaT, locale] = await Promise.all([
    getTranslations("admin.matchDetail"),
    getTranslations("admin.meta"),
    getLocale(),
  ]);
  const { id } = await params;
  const matchId = Number.parseInt(id, 10);
  if (!Number.isInteger(matchId) || matchId < 1) notFound();

  let match, stats, clubs;
  try {
    [match, stats, clubs] = await Promise.all([
      findMatchById(matchId),
      listMatchStats(matchId),
      listClubs({ approvedOnly: false, limit: 100 }),
    ]);
  } catch (error) {
    console.error("admin match detail", error);
    return (
      <>
        <AdminPageHeader title={metaT("matchDetail")} />
        <ErrorState title={t("databaseUnavailable")} />
      </>
    );
  }
  if (!match) notFound();

  const clubOptions = [
    ...(match.home_club_id
      ? [{ value: String(match.home_club_id), label: match.home_team_name }]
      : []),
    ...(match.away_club_id
      ? [{ value: String(match.away_club_id), label: match.away_team_name }]
      : []),
    ...clubs.rows
      .filter(
        (club) => club.id !== match.home_club_id && club.id !== match.away_club_id
      )
      .map((club) => ({ value: String(club.id), label: club.name })),
  ];

  return (
    <>
      <AdminPageHeader
        title={t("matchTitle", { home: match.home_team_name, away: match.away_team_name })}
        description={t("description", {
          season: locale === "vi" ? match.season_name_vi : match.season_name_en,
        })}
        action={
          <Link href="/admin/matches" className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">
            ← {t("allMatches")}
          </Link>
        }
      />

      <div className="mb-6">
        <ScoreConsole match={match} />
      </div>

      <Card className="mb-6 p-4">
        <h2 className="eyebrow mb-3 text-muted">
          {t("addStatLine")}
        </h2>
        <JsonForm
          action={`/api/admin/matches/${match.id}/stats`}
          submitLabel={t("add")}
          compact
          fields={[
            { name: "playerName", label: t("player"), required: true },
            {
              name: "clubId",
              label: t("club"),
              type: "select",
              options: clubOptions,
            },
            { name: "points", label: t("points"), type: "number", min: 0, max: 200 },
            { name: "assists", label: t("assists"), type: "number", min: 0, max: 100 },
          ]}
        />
      </Card>

      {stats.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Table
          caption={t("caption")}
          minWidth="32rem"
          head={
            <>
              <Th sticky>{t("player")}</Th>
              <Th align="right">{t("points")}</Th>
              <Th align="right">{t("assists")}</Th>
              <Th align="right">
                <span className="sr-only">{t("actions")}</span>
              </Th>
            </>
          }
        >
          {stats.map((stat) => (
            <tr
              key={stat.id}
              className="transition-colors duration-[var(--motion-fast)] hover:bg-surface-sunken"
            >
              <Td header sticky>
                {stat.player_name}
              </Td>
              <Td align="right" numeric strong className="font-display">
                {stat.points}
              </Td>
              <Td align="right" numeric className="text-muted">
                {stat.assists}
              </Td>
              <Td align="right">
                <ToggleButton
                  action={`/api/admin/matches/${match.id}/stats/${stat.id}`}
                  method="DELETE"
                  label={t("remove")}
                  tone="dangerGhost"
                  confirm={t("removeConfirm")}
                />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
