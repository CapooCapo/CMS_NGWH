export type AuditMetadataLabels = {
  score: string;
  homeFouls: string;
  awayFouls: string;
  status: string;
};

type AuditState = Record<string, unknown>;

function state(value: unknown): AuditState | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as AuditState
    : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function transition(label: string, before: unknown, after: unknown): string | null {
  const beforeValue = integer(before);
  const afterValue = integer(after);
  return beforeValue === null || afterValue === null
    ? null
    : `${label}: ${beforeValue} → ${afterValue}`;
}

/**
 * Presents allowlisted score metadata without changing the generic audit-log
 * fallback. Values come from the committed database row, never a request body.
 */
export function formatAuditMetadata(
  metadata: Record<string, unknown>,
  empty: string,
  labels: AuditMetadataLabels
): string {
  const before = state(metadata.before);
  const after = state(metadata.after);
  if (before && after) {
    const parts: string[] = [];
    const beforeHome = integer(before.homeScore);
    const beforeAway = integer(before.awayScore);
    const afterHome = integer(after.homeScore);
    const afterAway = integer(after.awayScore);
    if (
      beforeHome !== null &&
      beforeAway !== null &&
      afterHome !== null &&
      afterAway !== null
    ) {
      parts.push(`${labels.score}: ${beforeHome} - ${beforeAway} → ${afterHome} - ${afterAway}`);
    }
    const homeFouls = transition(labels.homeFouls, before.homeFouls, after.homeFouls);
    if (homeFouls) parts.push(homeFouls);
    const awayFouls = transition(labels.awayFouls, before.awayFouls, after.awayFouls);
    if (awayFouls) parts.push(awayFouls);
    if (typeof before.status === "string" && typeof after.status === "string") {
      parts.push(`${labels.status}: ${before.status} → ${after.status}`);
    }
    if (parts.length > 0) return parts.join("; ");
  }

  const text = JSON.stringify(metadata);
  return text === "{}" ? empty : text.length > 240 ? `${text.slice(0, 239)}…` : text;
}
