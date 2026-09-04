import Link from "next/link";
import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { ScoreConsole } from "@/components/admin/ScoreConsole";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, Card, EmptyState, ErrorState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { listClubs } from "@/server/repositories/clubs";
import { listAllMatches, listLiveMatches } from "@/server/repositories/matches";
import { listSeasons } from "@/server/repositories/seasons";
import { currentAdmin } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Matches & scoreboard",
  robots: { index: false, follow: false },
};

/**
 * REQ-TOURN-001 fixture management plus the live scoreboard console.
 *
 * Live matches are hoisted to the top with their consoles open, because during
 * a game that is the only thing the operator needs. Creating and deleting
 * fixtures is `editor`/`admin`; score updates are also open to `operator`.
 */
export default async function AdminMatchesPage() {
  const admin = await currentAdmin();

  let matches, seasons, clubs, live;
  try {
    [matches, seasons, clubs, live] = await Promise.all([
      listAllMatches(100),
      listSeasons(),
      listClubs({ approvedOnly: false, limit: 100 }),
      listLiveMatches(),
    ]);
  } catch (error) {
    console.error("admin matches", error);
    return (
      <>
        <AdminPageHeader title="Matches & scoreboard" />
        <ErrorState title="Database unavailable" />
      </>
    );
  }

  const seasonOptions = seasons.map((season) => ({
    value: String(season.id),
    label: season.name_en,
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

  return (
    <>
      <AdminPageHeader
        title="Matches & scoreboard"
        description="Scores entered here appear immediately on the public Live & Results widget."
      />

      {live.length > 0 && (
        <section aria-labelledby="live-consoles" className="mb-8">
          <h2
            id="live-consoles"
            className="eyebrow mb-3 flex items-center gap-2 text-muted"
          >
            Live now
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
          <Disclosure label="Add a fixture">
            {seasons.length === 0 ? (
              <p className="text-[length:var(--text-sm)] text-muted">
                Create a season first — a fixture must belong to one.
              </p>
            ) : (
              <JsonForm
                action="/api/admin/matches"
                submitLabel="Create fixture"
                fields={[
                  {
                    name: "seasonId",
                    label: "Season",
                    type: "select",
                    required: true,
                    options: seasonOptions,
                  },
                  {
                    name: "scheduledAt",
                    label: "Tip-off",
                    type: "datetime-local",
                    required: true,
                  },
                  { name: "homeTeamName", label: "Home team name", required: true },
                  { name: "awayTeamName", label: "Away team name", required: true },
                  {
                    name: "homeClubId",
                    label: "Home club (optional link)",
                    type: "select",
                    options: clubOptions,
                    hint: "Links the fixture to a club profile and the standings table.",
                  },
                  {
                    name: "awayClubId",
                    label: "Away club (optional link)",
                    type: "select",
                    options: clubOptions,
                  },
                  { name: "venue", label: "Venue" },
                  {
                    name: "status",
                    label: "Status",
                    type: "select",
                    required: true,
                    defaultValue: "scheduled",
                    options: [
                      { value: "scheduled", label: "Scheduled" },
                      { value: "live", label: "Live" },
                      { value: "completed", label: "Completed" },
                      { value: "postponed", label: "Postponed" },
                      { value: "cancelled", label: "Cancelled" },
                    ],
                  },
                  { name: "homeScore", label: "Home score", type: "number", min: 0, max: 500 },
                  { name: "awayScore", label: "Away score", type: "number", min: 0, max: 500 },
                ]}
              />
            )}
          </Disclosure>
        </div>
      )}

      {matches.length === 0 ? (
        <EmptyState title="No fixtures yet." />
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((match) => (
            <li key={match.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">
                        {match.home_team_name} vs {match.away_team_name}
                      </h2>
                      <Badge tone={match.status === "live" ? "live" : "neutral"}>
                        {match.status}
                      </Badge>
                      {(match.status === "live" || match.status === "completed") && (
                        <span className="font-display tabular font-bold">
                          {match.home_score}–{match.away_score}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[length:var(--text-sm)] text-muted">
                      {match.season_name_en} · {formatDateTime(match.scheduled_at, "en")}
                      {match.venue ? ` · ${match.venue}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/admin/matches/${match.id}`}
                      className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline"
                    >
                      Stats
                    </Link>
                    {(admin?.role === "superadmin" || admin?.role === "admin") && (
                      <ToggleButton
                        action={`/api/admin/matches/${match.id}`}
                        method="DELETE"
                        label="Delete"
                        tone="dangerGhost"
                        confirm="Delete this fixture? Its recorded statistics are deleted too."
                      />
                    )}
                  </div>
                </div>

                {match.status !== "live" && (
                  <div className="mt-3">
                    <Disclosure label="Scoreboard">
                      <ScoreConsole match={match} />
                    </Disclosure>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
