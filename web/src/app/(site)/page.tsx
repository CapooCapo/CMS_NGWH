import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { LiveResults } from "@/components/home/LiveResults";
import { NewsCard } from "@/components/news/NewsCard";
import { NewsListItem } from "@/components/news/NewsListItem";
import { PortableTextBody } from "@/components/PortableTextBody";
import {
  ActionLink,
  Badge,
  ButtonLink,
  Card,
  Container,
  EmptyState,
  Eyebrow,
  SectionHeading,
  Skeleton,
  SkeletonCards,
} from "@/components/ui";
import { SITE_NAME, SITE_TAGLINE, absoluteUrl } from "@/lib/site";
import { client } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import {
  HOME_HIGHLIGHTS_QUERY,
  HOME_NEWS_QUERY,
  HOME_PAGE_QUERY,
  galleryCategoryLabel,
} from "@/sanity/queries";

const options = { next: { revalidate: 30 } };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return {
    title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/") },
    openGraph: {
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: t("metaDescription"),
      url: absoluteUrl("/"),
    },
  };
}

/** REQ-HOME-004 / BR-002 — Hot News shows 3 to 5 items. */
async function HotNews() {
  const locale = await getLocale();
  const [t, common] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
  ]);
  const articles = await client.fetch(HOME_NEWS_QUERY, { language: locale }, options);
  // BR-002 caps the strip at five; the query already limits to five, and fewer
  // than three is simply what exists — the rule is a maximum, not padding.
  const items = articles.slice(0, 5);
  const [lead, ...rest] = items;

  return (
    <section aria-labelledby="hot-news">
      <SectionHeading
        id="hot-news"
        eyebrow={t("hotNewsEyebrow")}
        action={<ActionLink href="/news">{common("viewAll")}</ActionLink>}
      >
        {t("hotNews")}
      </SectionHeading>
      {items.length === 0 ? (
        <EmptyState title={t("hotNewsEmpty")} />
      ) : (
        /*
         * One image-led lead story beside a rule-separated headline list —
         * the way a sports front page stacks. A second card grid here would
         * have to height-match the tall lead card and would stretch over dead
         * space; a text list simply flows.
         */
        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:gap-10">
          <NewsCard item={lead} locale={locale} priority featured headingLevel={3} />
          {rest.length > 0 && (
            <div className="flex h-full flex-col">
              <Eyebrow tone="muted" className="mb-3 !text-muted">
                {t("moreHeadlines")}
              </Eyebrow>
              {/*
                The items share the column's height rather than bunching at the
                top, so the list reads as a deliberate companion to the tall
                lead card instead of stopping short of it.
              */}
              <ul className="flex flex-1 flex-col divide-y divide-border">
                {rest.map((article) => (
                  <li key={article._id} className="flex min-w-0 flex-1 flex-col justify-center">
                    <NewsListItem item={article} locale={locale} headingLevel={3} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

async function Highlights() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const items = await client.fetch(
    HOME_HIGHLIGHTS_QUERY,
    { language: locale },
    options
  );

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="highlights">
      <SectionHeading
        id="highlights"
        eyebrow={t("highlightsEyebrow")}
        action={<ActionLink href="/gallery">{t("viewGallery")}</ActionLink>}
      >
        {t("highlights")}
      </SectionHeading>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => {
          const src = item.photo
            ? urlForImage(item.photo as never).width(400).height(400).fit("crop").url()
            : null;
          const label = galleryCategoryLabel(locale, item.category);
          return (
            <li key={item._id}>
              <Link
                href="/gallery"
                className="group relative block aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-surface-strong"
              >
                {src && (
                  <Image
                    src={src}
                    alt={item.title ?? ""}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <span className="eyebrow absolute inset-x-0 bottom-0 bg-gradient-to-t from-court via-court/70 to-transparent px-2.5 pb-2 pt-6 text-white">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const locale = await getLocale();
  const [t, brand] = await Promise.all([
    getTranslations("home"),
    getTranslations("brand"),
  ]);

  const home = await client.fetch(HOME_PAGE_QUERY, { language: locale }, options);

  // REQ-HOME-001/002. With no Studio content yet, the hero still renders from
  // the brand constants so the page is never headless.
  const slides: HeroSlide[] = (home?.heroSlides ?? [])
    .filter((slide) => slide?.poster)
    .map((slide, i) => ({
      key: slide._key ?? String(i),
      headline: slide.headline ?? null,
      subheadline: slide.subheadline ?? null,
      videoUrl: slide.videoUrl ?? null,
      posterUrl: urlForImage(slide.poster as never)
        .width(1920)
        .height(1080)
        .fit("crop")
        .url(),
      posterAlt:
        (slide.poster as { alt?: string } | undefined)?.alt ?? slide.headline ?? null,
      ctaLabel: slide.ctaLabel ?? null,
      ctaHref: slide.ctaHref ?? null,
    }));

  const tagline = home?.tagline || brand("tagline") || SITE_TAGLINE;
  const champion = home?.championsCorner;
  const championImage = champion?.image
    ? urlForImage(champion.image as never).width(900).height(600).fit("crop").url()
    : null;

  return (
    <>
      {slides.length > 0 ? (
        <HeroCarousel
          slides={slides}
          tagline={tagline}
          labels={{
            previous: t("previousSlide"),
            next: t("nextSlide"),
            // The carousel substitutes {index}/{total} itself, so the
            // placeholders are passed through literally — calling t() without
            // them makes next-intl throw a FORMATTING_ERROR.
            slideOf: t("slideCounter", { index: "{index}", total: "{total}" }),
          }}
        />
      ) : (
        <section className="on-court bg-ink text-white">
          <Container className="py-20 sm:py-28">
            <p className="eyebrow mb-3 text-accent">{tagline}</p>
            <h1 className="max-w-[22ch] text-[length:var(--text-hero)] font-black leading-[0.95]">
              {t("heroFallbackHeadline")}
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/tournaments" tone="accent" size="lg">
                {t("exploreTournaments")}
              </ButtonLink>
              <ButtonLink href="/clubs/register" tone="onCourt" size="lg">
                {t("registerClub")}
              </ButtonLink>
            </div>
          </Container>
        </section>
      )}

      {/* REQ-HOME-003 — short mission overview. */}
      {home?.missionOverview && (
        <section
          aria-labelledby="mission"
          className="border-b border-border bg-surface-sunken"
        >
          <Container className="py-12 sm:py-16">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
              <div>
                <Eyebrow className="mb-3">{t("missionEyebrow")}</Eyebrow>
                <h2
                  id="mission"
                  className="text-[length:var(--text-2xl)] font-extrabold leading-[1.1] sm:text-[length:var(--text-3xl)]"
                >
                  {home.missionTitle || t("missionTitle")}
                </h2>
                <p className="mt-4 font-display text-[length:var(--text-sm)] font-bold uppercase tracking-[var(--tracking-eyebrow)] text-brand-text">
                  {tagline}
                </p>
              </div>
              <div className="max-w-[62ch] text-[length:var(--text-base)] leading-relaxed sm:text-[length:var(--text-lg)]">
                <PortableTextBody value={home.missionOverview} />
              </div>
            </div>
          </Container>
        </section>
      )}

      <Container className="flex flex-col gap-14 py-12 sm:gap-16 sm:py-16">
        <Suspense
          fallback={
            <div className="flex flex-col gap-5">
              <Skeleton className="h-9 w-52" />
              <SkeletonCards count={3} />
            </div>
          }
        >
          <HotNews />
        </Suspense>

        <Suspense
          fallback={
            <div className="flex flex-col gap-5">
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-48" />
            </div>
          }
        >
          <LiveResults />
        </Suspense>

        {/* REQ-HOME-006 — Champions Corner. */}
        {champion?.clubName && (
          <section aria-labelledby="champions">
            <SectionHeading id="champions" eyebrow={t("championsEyebrow")}>
              {t("championsCorner")}
            </SectionHeading>
            {/*
              The one dark panel in the page body. Reserved for this and the
              scoreboard, so it reads as a trophy case rather than one more
              bordered box.
            */}
            <Card variant="panel" className="overflow-hidden">
              <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
                <div className="relative aspect-[3/2] bg-ink-raised md:aspect-auto md:min-h-[22rem]">
                  {championImage && (
                    <Image
                      src={championImage}
                      alt={
                        (champion.image as { alt?: string } | undefined)?.alt ??
                        champion.clubName
                      }
                      fill
                      sizes="(max-width: 768px) 100vw, 55vw"
                      className="object-cover"
                    />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent md:bg-gradient-to-r md:from-transparent md:via-ink/10 md:to-ink/75"
                  />
                </div>
                <div className="flex flex-col justify-center gap-4 p-6 sm:p-9">
                  <div>
                    <Badge tone="accent">{t("defendingChampion")}</Badge>
                  </div>
                  {champion.seasonLabel && (
                    <Eyebrow tone="onCourt">{champion.seasonLabel}</Eyebrow>
                  )}
                  <h3 className="text-[length:var(--text-2xl)] font-black leading-tight sm:text-[length:var(--text-3xl)]">
                    {champion.clubName}
                  </h3>
                  {champion.summary && (
                    <p className="max-w-[46ch] text-[length:var(--text-sm)] leading-relaxed text-ink-muted">
                      {champion.summary}
                    </p>
                  )}
                  {champion.clubSlug && (
                    <div className="mt-1">
                      <ButtonLink href={`/clubs/${champion.clubSlug}`} tone="onCourt">
                        {t("viewClubProfile")}
                      </ButtonLink>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </section>
        )}

        <Suspense fallback={<Skeleton className="h-40" />}>
          <Highlights />
        </Suspense>
      </Container>
    </>
  );
}
