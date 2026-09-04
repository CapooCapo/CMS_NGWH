import { defineQuery } from "next-sanity";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Human labels for the category enums fixed in the Studio schemas.
 *
 * The Sanity *values* (`tournament-news`, `hall-of-glory`, …) are the contract
 * with the schema and never change; only these display strings are localized.
 * Adding a category means editing the schema `options.list` and every locale
 * below.
 */
type CategoryLabels = Record<Locale, Record<string, string>>;

export const NEWS_CATEGORY_LABELS: CategoryLabels = {
  en: {
    "tournament-news": "Tournament News",
    "inspirational-stories": "Inspirational Stories",
    "knowledge-nutrition": "Knowledge & Nutrition",
  },
  vi: {
    "tournament-news": "Tin giải đấu",
    "inspirational-stories": "Câu chuyện truyền cảm hứng",
    "knowledge-nutrition": "Kiến thức & Dinh dưỡng",
  },
};

export const GALLERY_CATEGORY_LABELS: CategoryLabels = {
  en: {
    "hall-of-glory": "Hall of Glory",
    "mvp-spotlight": "MVP Spotlight",
    "behind-the-scenes": "Behind the Scenes",
  },
  vi: {
    "hall-of-glory": "Sảnh vinh danh",
    "mvp-spotlight": "Cầu thủ xuất sắc nhất",
    "behind-the-scenes": "Hậu trường",
  },
};

/**
 * Resolves a category value to its label for `locale`, falling back to the
 * default locale and finally to the raw value, so an unknown or newly added
 * category degrades to something readable instead of rendering blank.
 */
function categoryLabel(
  labels: CategoryLabels,
  locale: string,
  category: string | null | undefined
): string | null {
  if (!category) return null;
  const forLocale = labels[locale as Locale] ?? labels[DEFAULT_LOCALE];
  return forLocale[category] ?? labels[DEFAULT_LOCALE][category] ?? category;
}

export const newsCategoryLabel = (
  locale: string,
  category: string | null | undefined
) => categoryLabel(NEWS_CATEGORY_LABELS, locale, category);

export const galleryCategoryLabel = (
  locale: string,
  category: string | null | undefined
) => categoryLabel(GALLERY_CATEGORY_LABELS, locale, category);

export const NEWS_LIST_QUERY = defineQuery(
  `*[_type == "newsArticle" && language == $language && defined(slug.current)] | order(date desc){ _id, title, slug, category, date, coverImage }`
);

export const NEWS_ARTICLE_QUERY = defineQuery(
  `*[_type == "newsArticle" && language == $language && slug.current == $slug][0]{ _id, title, category, date, coverImage, body }`
);

// `partner` is a single shared document per organisation (it has no per-locale
// `language` field), so the role is stored in `roleEn`/`roleVi` and picked here
// by the requested locale. `role` is the pre-bilingual field, kept last in the
// coalesce so documents that predate the split still render.
export const ABOUT_PAGE_QUERY = defineQuery(
  `*[_type == "aboutPage" && language == $language][0]{
    brandStory,
    vision,
    mission,
    tournamentSystem,
    organizerAndPartners,
    images,
    partners[]-> {
      _id,
      name,
      "role": coalesce(select($language == "vi" => roleVi), roleEn, role),
      logo
    }
  }`
);

export const GALLERY_ITEMS_QUERY = defineQuery(
  `*[_type == "galleryItem" && language == $language] | order(_createdAt desc){ _id, category, title, photos, body }`
);

/**
 * REQ-HOME-001..006 — Home page editorial content.
 *
 * Operational data on Home (Live & Results) is not here: it comes from the
 * application database via `src/server/repositories/matches.ts`.
 */
export const HOME_PAGE_QUERY = defineQuery(
  `*[_type == "homePage" && language == $language][0]{
    tagline,
    missionTitle,
    missionOverview,
    heroSlides[]{
      _key,
      headline,
      subheadline,
      videoUrl,
      poster,
      ctaLabel,
      ctaHref
    },
    championsCorner{
      clubName,
      seasonLabel,
      summary,
      image,
      clubSlug
    }
  }`
);

/** REQ-HOME-004 / BR-002 — "Hot News" shows 3 to 5 items. */
export const HOME_NEWS_QUERY = defineQuery(
  `*[_type == "newsArticle" && language == $language && defined(slug.current)]
    | order(date desc)[0...5]{ _id, title, slug, category, date, coverImage }`
);

/** REQ-HOME-001 / gallery highlights strip on Home. */
export const HOME_HIGHLIGHTS_QUERY = defineQuery(
  `*[_type == "galleryItem" && language == $language && count(photos) > 0]
    | order(_createdAt desc)[0...6]{ _id, title, category, "photo": photos[0] }`
);

/** REQ-CONTACT-001 — office info, hotline and support emails. */
export const CONTACT_PAGE_QUERY = defineQuery(
  `*[_type == "contactPage" && language == $language][0]{
    officeName,
    address,
    hotline,
    emails[]{ label, address },
    officeHours,
    note,
    formIntro
  }`
);

/** Adjacent articles for the "more news" strip on an article page. */
export const NEWS_RELATED_QUERY = defineQuery(
  `*[_type == "newsArticle" && language == $language && defined(slug.current)
      && slug.current != $slug]
    | order(date desc)[0...3]{ _id, title, slug, category, date, coverImage }`
);

/** Slugs for the sitemap (area M). */
export const NEWS_SITEMAP_QUERY = defineQuery(
  `*[_type == "newsArticle" && defined(slug.current)]{
    "slug": slug.current,
    "updatedAt": _updatedAt
  }`
);

/**
 * Locale-equivalent slug for an article, via the document-internationalization
 * `translation.metadata` documents.
 *
 * Slugs are per-document, so the EN and VI versions of one article have
 * different slugs. Switching locale on an article page would otherwise 404;
 * this resolves the sibling slug so the visitor lands on the translation.
 */
export const NEWS_TRANSLATIONS_QUERY = defineQuery(
  `*[_type == "translation.metadata" &&
      references(*[_type == "newsArticle" && slug.current == $slug][0]._id)][0]
    .translations[]{ "language": value->language, "slug": value->slug.current }`
);
