import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  SeasonNav,
  SeasonView,
  seasonStatusLabel,
} from "@/components/tournaments/SeasonView";
import {
  Badge,
  Container,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui";
import { formatDateShort } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { findCurrentSeason, listSeasons } from "@/server/repositories/seasons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tournaments");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/tournaments") },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      url: absoluteUrl("/tournaments"),
    },
  };
}

/**
 * Tournaments landing page: the current season in full, with the archive
 * (REQ-TOURN-004) exposed as the season switcher above it.
 */
export default async function TournamentsPage() {
  const locale = await getLocale();
  const [t, common] = await Promise.all([
    getTranslations("tournaments"),
    getTranslations("common"),
  ]);

  let seasons: Awaited<ReturnType<typeof listSeasons>> = [];
  let current: Awaited<ReturnType<typeof findCurrentSeason>> = null;
  let failed = false;
  try {
    [seasons, current] = await Promise.all([listSeasons(), findCurrentSeason()]);
  } catch {
    failed = true;
  }

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("metaDescription")}
      />
      <Container className="py-10 sm:py-12">
        {failed ? (
          <ErrorState title={common("error")} body={common("errorBody")} />
        ) : seasons.length === 0 ? (
          <EmptyState title={t("noSeasons")} />
        ) : (
          <>
            <SeasonNav seasons={seasons} activeSlug={current?.slug ?? null} />
            {current && (
              <>
                <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-5">
                  <h2 className="text-[length:var(--text-2xl)] font-extrabold leading-tight">
                    {locale === "vi" ? current.name_vi : current.name_en}
                  </h2>
                  <Badge tone={current.status === "active" ? "success" : "neutral"}>
                    {await seasonStatusLabel(current.status)}
                  </Badge>
                  {current.starts_on && (
                    <span className="tabular text-[length:var(--text-sm)] text-muted">
                      {formatDateShort(current.starts_on, locale)}
                      {current.ends_on
                        ? ` – ${formatDateShort(current.ends_on, locale)}`
                        : ""}
                    </span>
                  )}
                </div>
                <SeasonView season={current} />
              </>
            )}
          </>
        )}
      </Container>
    </>
  );
}
