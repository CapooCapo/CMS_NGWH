import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { JsonForm } from "@/components/admin/JsonForm";
import { ScoreConsole } from "@/components/admin/ScoreConsole";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Card, EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { listClubs } from "@/server/repositories/clubs";
import { findMatchById } from "@/server/repositories/matches";
import { listMatchStats } from "@/server/repositories/stats";

export const metadata: Metadata = {
  title: "Match statistics",
  robots: { index: false, follow: false },
};

/**
 * Per-match statistics entry (REQ-TOURN-003).
 *
 * Only points and assists are recorded — those are the two categories the
 * requirement names, and OQ-008 (the full category list) is still Open, so no
 * further columns are invented here.
 */
export default async function AdminMatchDetailPage({
  params,
}: PageProps<"/admin/matches/[id]">) {
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
        <AdminPageHeader title="Match statistics" />
        <ErrorState title="Database unavailable" />
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
        title={`${match.home_team_name} vs ${match.away_team_name}`}
        description={`${match.season_name_en} — statistics are limited to points and assists (REQ-TOURN-003; OQ-008 open).`}
        action={
          <Link href="/admin/matches" className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">
            ← All matches
          </Link>
        }
      />

      <div className="mb-6">
        <ScoreConsole match={match} />
      </div>

      <Card className="mb-6 p-4">
        <h2 className="eyebrow mb-3 text-muted">
          Add a stat line
        </h2>
        <JsonForm
          action={`/api/admin/matches/${match.id}/stats`}
          submitLabel="Add"
          compact
          fields={[
            { name: "playerName", label: "Player", required: true },
            {
              name: "clubId",
              label: "Club",
              type: "select",
              options: clubOptions,
            },
            { name: "points", label: "Points", type: "number", min: 0, max: 200 },
            { name: "assists", label: "Assists", type: "number", min: 0, max: 100 },
          ]}
        />
      </Card>

      {stats.length === 0 ? (
        <EmptyState title="No statistics recorded for this match." />
      ) : (
        <Table
          caption="Recorded statistics"
          minWidth="32rem"
          head={
            <>
              <Th sticky>Player</Th>
              <Th align="right">Points</Th>
              <Th align="right">Assists</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
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
                  label="Remove"
                  tone="dangerGhost"
                  confirm="Remove this stat line?"
                />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
