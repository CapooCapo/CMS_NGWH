import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Locale-aware date/time formatting.
 *
 * A fixed IANA zone is used rather than the server's local zone so a fixture
 * renders as the same wall-clock time on the server and in the browser —
 * otherwise SSR and hydration disagree and the tip-off time visibly shifts.
 * REQ-TOURN-001 is about schedule times, so this matters.
 */
const TIME_ZONE = process.env.NEXT_PUBLIC_SITE_TIME_ZONE || "Asia/Ho_Chi_Minh";

const intlLocale = (locale: string) => (locale === "vi" ? "vi-VN" : "en-GB");

function safeFormat(
  value: string | Date | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(intlLocale(locale || DEFAULT_LOCALE), {
    timeZone: TIME_ZONE,
    ...options,
  }).format(date);
}

export const formatDate = (
  value: string | Date | null | undefined,
  locale: string
) => safeFormat(value, locale, { day: "numeric", month: "long", year: "numeric" });

export const formatDateShort = (
  value: string | Date | null | undefined,
  locale: string
) => safeFormat(value, locale, { day: "2-digit", month: "short", year: "numeric" });

export const formatTime = (
  value: string | Date | null | undefined,
  locale: string
) => safeFormat(value, locale, { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (
  value: string | Date | null | undefined,
  locale: string
) =>
  safeFormat(value, locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** `<time datetime="…">` needs a machine-readable value. */
export function isoDate(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Win percentage as ".750"-style text, the convention on basketball tables. */
export function formatWinPct(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}
