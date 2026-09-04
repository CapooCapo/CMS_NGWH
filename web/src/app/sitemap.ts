import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
import { client } from "@/sanity/client";
import { NEWS_SITEMAP_QUERY } from "@/sanity/queries";
import { listClubs } from "@/server/repositories/clubs";
import { listSeasons } from "@/server/repositories/seasons";

/**
 * Sitemap (area M).
 *
 * Combines both content sources: editorial URLs from Sanity and operational
 * URLs from PostgreSQL. Each source is fetched independently and a failure in
 * one only drops its own entries, so a database outage still produces a valid
 * sitemap for the static and Sanity-backed routes.
 *
 * `/admin` and every API route are omitted by construction, and additionally
 * disallowed in robots.ts.
 */
export const revalidate = 3600;

const STATIC_PATHS = [
  { path: "/", priority: 1 },
  { path: "/about", priority: 0.8 },
  { path: "/tournaments", priority: 0.9 },
  { path: "/news", priority: 0.9 },
  { path: "/gallery", priority: 0.7 },
  { path: "/clubs", priority: 0.8 },
  { path: "/clubs/register", priority: 0.6 },
  { path: "/contact", priority: 0.5 },
  { path: "/live", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((entry) => ({
    url: `${origin}${entry.path}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: entry.priority,
  }));

  // News articles (Sanity). Slugs are shared across locales, so each appears once.
  try {
    const articles = await client.fetch(
      NEWS_SITEMAP_QUERY,
      {},
      { next: { revalidate: 3600 } }
    );
    const seen = new Set<string>();
    for (const article of articles) {
      if (!article.slug || seen.has(article.slug)) continue;
      seen.add(article.slug);
      entries.push({
        url: `${origin}/news/${article.slug}`,
        lastModified: article.updatedAt ? new Date(article.updatedAt) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (error) {
    console.error("sitemap: news source unavailable", error);
  }

  // Approved clubs only — BR-001 keeps pending profiles out of the index.
  try {
    const { rows } = await listClubs({ approvedOnly: true, limit: 100 });
    for (const club of rows) {
      entries.push({
        url: `${origin}/clubs/${club.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (error) {
    console.error("sitemap: clubs source unavailable", error);
  }

  try {
    for (const season of await listSeasons()) {
      entries.push({
        url: `${origin}/tournaments/${season.slug}`,
        lastModified: now,
        changeFrequency: season.status === "active" ? "daily" : "monthly",
        priority: season.status === "active" ? 0.9 : 0.5,
      });
    }
  } catch (error) {
    console.error("sitemap: seasons source unavailable", error);
  }

  return entries;
}
