import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClubCard } from "@/components/clubs/ClubCard";
import { ClubFilters } from "@/components/clubs/ClubFilters";
import {
  Container,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui";
import { absoluteUrl } from "@/lib/site";
import { listClubs, listProvinces } from "@/server/repositories/clubs";
import type { PageSearchParams } from "@/app/page-props";

type PageProps = {
  searchParams: PageSearchParams;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clubs");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/clubs") },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      url: absoluteUrl("/clubs"),
    },
  };
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * REQ-CLUB-001/002 — public club directory as a searchable, province-filtered
 * list.
 *
 * OQ-009 asks whether the directory should be a map, a list, or both. Only the
 * list is implemented: it is the half that is unambiguous, and building a map
 * would mean choosing a tile provider and a geocoding source that no
 * requirement names. The page is structured so a map can be added above the
 * list later without changing the data layer.
 *
 * BR-001 is enforced by passing `approvedOnly: true` — pending clubs are never
 * listed here.
 */
export default async function ClubsPage({ searchParams }: PageProps) {
  const [t, common] = await Promise.all([
    getTranslations("clubs"),
    getTranslations("common"),
  ]);
  const params = await searchParams;
  const search = first(params.q).slice(0, 100);
  const province = first(params.province).slice(0, 160);

  let clubs: Awaited<ReturnType<typeof listClubs>> = { rows: [], total: 0 };
  let provinces: string[] = [];
  let failed = false;
  try {
    [clubs, provinces] = await Promise.all([
      listClubs({ approvedOnly: true, search, province, limit: 60 }),
      listProvinces(true),
    ]);
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
        ) : (
          <>
            <ClubFilters
              provinces={provinces}
              search={search}
              province={province}
            />
            <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--text-sm)] text-muted">
              <span className="font-display font-bold tabular text-foreground">
                {t("resultsCount", { count: clubs.total })}
              </span>
              <span aria-hidden="true">·</span>
              <span>{t("approvedNotice")}</span>
            </p>
            {clubs.rows.length === 0 ? (
              <EmptyState
                title={search || province ? t("empty") : t("emptyAll")}
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {clubs.rows.map((club) => (
                  // `min-w-0` on the grid item: without it the item keeps
                  // `min-width: auto` and can overflow its track on very
                  // narrow viewports.
                  <li key={club.id} className="min-w-0">
                    <ClubCard
                      club={club}
                      labels={{ founded: t("founded") }}
                      headingLevel={2}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Container>
    </>
  );
}
