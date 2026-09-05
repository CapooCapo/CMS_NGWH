"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Button, Card, Eyebrow, LiveBadge } from "@/components/ui";
import type { MatchStatus, MatchWithContext } from "@/server/repositories/types";

const STATUSES: readonly MatchStatus[] = ["scheduled", "live", "completed", "postponed", "cancelled"];

type ConfirmedMatch = Pick<
  MatchWithContext,
  "home_score" | "away_score" | "home_fouls" | "away_fouls" | "status" | "period" | "live_revision"
>;

/**
 * One match's live operator console. The +/- controls post atomic deltas to
 * the canonical score route; a client queue preserves every rapid click
 * without showing a score PostgreSQL has not confirmed.
 */
export function ScoreConsole({ match }: { match: MatchWithContext }) {
  const locale = useLocale();
  const t = useTranslations("admin.score");
  const statusT = useTranslations("admin.status");
  const [home, setHome] = useState(match.home_score);
  const [away, setAway] = useState(match.away_score);
  const [homeFouls, setHomeFouls] = useState(match.home_fouls);
  const [awayFouls, setAwayFouls] = useState(match.away_fouls);
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [period, setPeriod] = useState(match.period ?? "");
  const [confirmed, setConfirmed] = useState<ConfirmedMatch>(match);
  const [queuedAdjustments, setQueuedAdjustments] = useState(0);
  const [pendingSave, setPendingSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const adjustmentQueue = useRef(Promise.resolve());

  const dirty =
    home !== confirmed.home_score ||
    away !== confirmed.away_score ||
    status !== confirmed.status ||
    (period || null) !== confirmed.period;

  function applyConfirmed(next: MatchWithContext) {
    setHome(next.home_score);
    setAway(next.away_score);
    setHomeFouls(next.home_fouls);
    setAwayFouls(next.away_fouls);
    setStatus(next.status);
    setPeriod(next.period ?? "");
    setConfirmed(next);
    setSavedAt(
      new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())
    );
  }

  function adjust(team: "home" | "away", kind: "score" | "foul", delta: -3 | -2 | -1 | 1 | 2 | 3) {
    setQueuedAdjustments((count) => count + 1);
    adjustmentQueue.current = adjustmentQueue.current
      .then(async () => {
        setError(null);
        const response = await fetch(`/api/admin/matches/${match.id}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team, kind, delta }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          match?: MatchWithContext;
        };
        if (!response.ok || !data.match) {
          setError(
            data.error === "forbidden"
              ? t("forbidden")
              : data.error === "scoreOutOfRange"
                ? t("belowZero", { kind: t(kind === "foul" ? "fouls" : "scores") })
                : t("saveFailed", { kind: t(kind) })
          );
          return;
        }
        applyConfirmed(data.match);
      })
      .catch(() => setError(t("saveFailed", { kind: t("score") })))
      .finally(() => setQueuedAdjustments((count) => Math.max(0, count - 1)));
  }

  async function save() {
    setPendingSave(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/matches/${match.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeScore: home,
          awayScore: away,
          status,
          period: period.trim() || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        match?: MatchWithContext;
      };
      if (!response.ok || !data.match) {
        setError(
          data.error === "forbidden"
            ? t("forbidden")
            : t("saveFailed", { kind: t("score") })
        );
        return;
      }
      applyConfirmed(data.match);
    } catch {
      setError(t("saveFailed", { kind: t("score") }));
    } finally {
      setPendingSave(false);
    }
  }

  const controls = (team: "home" | "away", label: string, value: number, fouls: number) => (
    <div className="min-w-0 flex-1">
      <p className="mb-2 truncate text-[length:var(--text-sm)] font-semibold">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {([-3, -2, -1] as const).map((delta) => (
            <Button
              key={delta}
              type="button"
              tone="onCourt"
              size="sm"
              disabled={value + delta < 0 || pendingSave}
              onClick={() => adjust(team, "score", delta)}
              aria-label={t("subtract", { count: Math.abs(delta), team: label })}
            >
              {delta}
            </Button>
          ))}
        </div>
        <span className="font-display tabular w-16 text-center text-[length:var(--text-4xl)] font-black text-white">
          {value}
        </span>
        <div className="flex gap-1">
          {([1, 2, 3] as const).map((delta) => (
            <Button
              key={delta}
              type="button"
              tone="onCourt"
              size="sm"
              disabled={pendingSave}
              onClick={() => adjust(team, "score", delta)}
              aria-label={t("add", { count: delta, team: label })}
            >
              +{delta}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[length:var(--text-xs)] text-ink-muted">
        <span className="font-semibold text-white">{t("fouls")}: {fouls}</span>
        <Button
          type="button"
          tone="onCourt"
          size="sm"
          disabled={fouls <= 0 || pendingSave}
          onClick={() => adjust(team, "foul", -1)}
          aria-label={t("subtractFoul", { team: label })}
        >
          −
        </Button>
        <Button
          type="button"
          tone="onCourt"
          size="sm"
          disabled={pendingSave}
          onClick={() => adjust(team, "foul", 1)}
          aria-label={t("addFoul", { team: label })}
        >
          +
        </Button>
      </div>
    </div>
  );

  return (
    <Card variant="panel" className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h3 className="min-w-0 flex-1 truncate text-[length:var(--text-base)] font-bold">
          {match.home_team_name} <span className="text-ink-muted">{t("versus")}</span>{" "}
          {match.away_team_name}
        </h3>
        {status === "live" ? <LiveBadge label={statusT("live")} /> : <Badge tone="neutral">{statusT(status)}</Badge>}
        {queuedAdjustments > 0 && <Badge tone="accent">{t("savingScore")}</Badge>}
        {dirty && <Badge tone="warning">{statusT("unsaved")}</Badge>}
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {controls("home", match.home_team_name, home, homeFouls)}
        {controls("away", match.away_team_name, away, awayFouls)}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-ink-border pt-4">
        <div>
          <label htmlFor={`status-${match.id}`} className="mb-1.5 block">
            <Eyebrow tone="muted" className="!text-ink-muted">{t("status")}</Eyebrow>
          </label>
          <select
            id={`status-${match.id}`}
            value={status}
            disabled={queuedAdjustments > 0}
            onChange={(event) => setStatus(event.target.value as MatchStatus)}
            className="h-10 rounded-[var(--radius-md)] border border-ink-border bg-ink-raised px-3 text-[length:var(--text-sm)] text-white focus:border-accent focus:outline-none disabled:opacity-55"
          >
            {STATUSES.map((value) => <option key={value} value={value} className="text-foreground">{statusT(value)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`period-${match.id}`} className="mb-1.5 block">
            <Eyebrow tone="muted" className="!text-ink-muted">{t("period")}</Eyebrow>
          </label>
          <input
            id={`period-${match.id}`}
            value={period}
            disabled={queuedAdjustments > 0}
            onChange={(event) => setPeriod(event.target.value)}
            placeholder={t("periodPlaceholder")}
            maxLength={20}
            className="h-10 w-24 rounded-[var(--radius-md)] border border-ink-border bg-ink-raised px-3 text-[length:var(--text-sm)] text-white placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:opacity-55"
          />
        </div>
        <Button tone="accent" onClick={save} disabled={!dirty || queuedAdjustments > 0} loading={pendingSave} loadingLabel={t("saving")}>
          {t("save")}
        </Button>
        {savedAt && !dirty && (
          <span className="text-[length:var(--text-xs)] text-ink-muted" aria-live="polite">{t("saved", { time: savedAt })}</span>
        )}
      </div>

      {error && <p role="alert" className="mt-3 text-[length:var(--text-xs)] font-semibold text-live-text">{error}</p>}
    </Card>
  );
}
