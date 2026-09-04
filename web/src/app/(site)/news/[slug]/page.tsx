import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { NewsCard } from "@/components/news/NewsCard";
import { PortableTextBody } from "@/components/PortableTextBody";
import { Badge, Breadcrumbs, Container, SectionHeading } from "@/components/ui";
import { formatDate, isoDate } from "@/lib/format";
import { SITE_NAME, absoluteUrl } from "@/lib/site";
import { client } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import {
  NEWS_ARTICLE_QUERY,
  NEWS_RELATED_QUERY,
  NEWS_TRANSLATIONS_QUERY,
  newsCategoryLabel,
} from "@/sanity/queries";

const options = { next: { revalidate: 30 } };

/**
 * Dynamic metadata for a news article (area M): canonical URL, Open Graph
 * article tags and the cover image as the social card.
 */
export async function generateMetadata({
  params,
}: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const article = await client.fetch(
    NEWS_ARTICLE_QUERY,
    { slug, language: locale },
    options
  );
  if (!article) return { title: "Not found", robots: { index: false } };

  const url = absoluteUrl(`/news/${slug}`);
  const image = article.coverImage
    ? urlForImage(article.coverImage as never).width(1200).height(630).fit("crop").url()
    : null;

  // First paragraph of the body, trimmed, as the description.
  const description = Array.isArray(article.body)
    ? (article.body
        .filter((block) => (block as { _type?: string })._type === "block")
        .flatMap((block) =>
          ((block as { children?: { text?: string }[] }).children ?? []).map(
            (child) => child.text ?? ""
          )
        )
        .join(" ")
        .trim()
        .slice(0, 200) || undefined)
    : undefined;

  return {
    title: article.title ?? undefined,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: article.title ?? undefined,
      description,
      url,
      siteName: SITE_NAME,
      publishedTime: isoDate(article.date),
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: article.title ?? undefined,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function NewsArticlePage({
  params,
}: PageProps<"/news/[slug]">) {
  const { slug } = await params;
  const locale = await getLocale();
  const [t, nav] = await Promise.all([
    getTranslations("news"),
    getTranslations("nav"),
  ]);

  const article = await client.fetch(
    NEWS_ARTICLE_QUERY,
    { slug, language: locale },
    options
  );

  // Slugs are per-locale, so a visitor who switches language on this page asks
  // for a slug that does not exist in the new locale. Before 404-ing, follow
  // the article's translation metadata and send them to the sibling slug.
  if (!article) {
    const translations = await client.fetch(
      NEWS_TRANSLATIONS_QUERY,
      { slug },
      options
    );
    const sibling = translations?.find(
      (entry) => entry?.language === locale && entry?.slug
    );
    if (sibling?.slug && sibling.slug !== slug) {
      redirect(`/news/${sibling.slug}`);
    }
    notFound();
  }

  const label = newsCategoryLabel(locale, article.category);
  const cover = article.coverImage
    ? urlForImage(article.coverImage as never).width(1600).height(900).fit("crop").url()
    : null;
  const coverAlt =
    (article.coverImage as { alt?: string } | undefined)?.alt ?? "";

  const related = await client.fetch(
    NEWS_RELATED_QUERY,
    { slug, language: locale },
    options
  );

  return (
    <>
      <article>
        <Container width="prose" className="pt-8">
          <Breadcrumbs
            label={nav("primary")}
            items={[
              { href: "/", label: nav("home") },
              { href: "/news", label: t("title") },
              { label: article.title ?? "" },
            ]}
          />
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {label && <Badge tone="accent">{label}</Badge>}
            {article.date && (
              <time
                dateTime={isoDate(article.date)}
                className="eyebrow tabular text-muted"
              >
                {formatDate(article.date, locale)}
              </time>
            )}
          </div>
          <h1 className="text-[length:var(--text-3xl)] font-black leading-[1.05] sm:text-[length:var(--text-4xl)]">
            {article.title}
          </h1>
        </Container>

        {cover && (
          <Container className="mt-8">
            <div className="relative mx-auto aspect-[16/9] w-full max-w-5xl overflow-hidden rounded-[var(--radius-md)] bg-surface-strong">
              <Image
                src={cover}
                alt={coverAlt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
              />
            </div>
          </Container>
        )}

        <Container width="prose" className="py-10 sm:py-12">
          {/* Rule opens the body, so the headline block reads as a masthead. */}
          <div className="border-t border-border pt-8 text-[length:var(--text-lg)] leading-[1.75]">
            <PortableTextBody value={article.body} />
          </div>
          <div className="mt-10 border-t border-border pt-6">
            <Link
              href="/news"
              className="inline-flex items-center gap-2 text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline"
            >
              <span aria-hidden="true">←</span> {t("back")}
            </Link>
          </div>
        </Container>
      </article>

      {related.length > 0 && (
        <Container className="pb-16">
          <SectionHeading>{t("relatedTitle")}</SectionHeading>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item._id} className="min-w-0">
                <NewsCard item={item} locale={locale} />
              </li>
            ))}
          </ul>
        </Container>
      )}
    </>
  );
}
