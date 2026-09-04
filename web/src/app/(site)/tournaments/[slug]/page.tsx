import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  SeasonNav,
  SeasonView,
  seasonStatusLabel,
} from "@/components/tournaments/SeasonView";
import { Badge, Container, PageHeader } from "@/components/ui";
import { formatDateShort } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { findSeasonBySlug, listSeasons } from "@/server/repositories/seasons";

/** Dynamic metadata per season (area M). */
export async function generateMetadata({
  params,
}: PageProps<"/tournaments/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  let season = null;
  try {
    season = await findSeasonBySlug(slug);
  } catch {
    // Metadata must never throw; the page itself reports the failure.
  }
  if (!season) return { title: "Not found", robots: { index: false } };

  const name = locale === "vi" ? season.name_vi : season.name_en;
  const t = await getTranslations("tournaments");
  return {
    title: name,
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl(`/tournaments/${slug}`) },
    openGraph: {
      title: name,
      description: t("metaDescription"),
      url: absoluteUrl(`/tournaments/${slug}`),
    },
  };
}

export default async function SeasonPage({
  params,
}: PageProps<"/tournaments/[slug]">) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("tournaments");

  const [season, seasons] = await Promise.all([
    findSeasonBySlug(slug),
    listSeasons(),
  ]);
  if (!season) notFound();

  const name = locale === "vi" ? season.name_vi : season.name_en;

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("metaDescription")}
      />
      <Container className="py-10 sm:py-12">
        <SeasonNav seasons={seasons} activeSlug={season.slug} />
        <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-5">
          <h2 className="text-[length:var(--text-2xl)] font-extrabold leading-tight">
            {name}
          </h2>
          <Badge tone={season.status === "active" ? "success" : "neutral"}>
            {await seasonStatusLabel(season.status)}
          </Badge>
          {season.starts_on && (
            <span className="tabular text-[length:var(--text-sm)] text-muted">
              {formatDateShort(season.starts_on, locale)}
              {season.ends_on ? ` – ${formatDateShort(season.ends_on, locale)}` : ""}
            </span>
          )}
        </div>
        <SeasonView season={season} />
      </Container>
    </>
  );
}
