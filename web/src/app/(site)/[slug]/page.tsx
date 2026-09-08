import { permanentRedirect, notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { client } from "@/sanity/client";
import { NEWS_ARTICLE_QUERY } from "@/sanity/queries";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Legacy article URLs.
 *
 * News articles used to live at `/<slug>`; they now live under `/news/<slug>`
 * so the root can hold the real homepage (REQ-HOME-*) without a catch-all
 * swallowing new top-level sections. This route is kept purely so previously
 * shared links keep working: it 308-redirects to the new path when the slug is
 * a real article, and 404s otherwise.
 */
export default async function LegacyArticleRedirect({
  params,
}: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const article = await client.fetch(
    NEWS_ARTICLE_QUERY,
    { slug, language: locale },
    { next: { revalidate: 30 } }
  );
  if (!article) notFound();
  permanentRedirect(`/news/${slug}`);
}
