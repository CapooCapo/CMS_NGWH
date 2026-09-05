import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { NewsCard } from "@/components/news/NewsCard";
import { PaginationControl } from "@/components/PaginationControl";
import {
  Container,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { absoluteUrl } from "@/lib/site";
import { client } from "@/sanity/client";
import {
  NEWS_CATEGORY_LABELS,
  NEWS_LIST_QUERY,
  newsCategoryLabel,
} from "@/sanity/queries";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

const options = { next: { revalidate: 30 } };
const PER_PAGE = 9;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("news");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/news") },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      url: absoluteUrl("/news"),
    },
  };
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * REQ-NEWS-001/002/003 — the three news categories share one listing with a
 * category filter, because they are categories of the same `newsArticle` type
 * rather than three separate feeds.
 */
export default async function NewsIndexPage({
  searchParams,
}: PageProps<"/news">) {
  const locale = await getLocale();
  const [t, common] = await Promise.all([
    getTranslations("news"),
    getTranslations("common"),
  ]);
  const params = await searchParams;

  const rawCategory = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const known = Object.keys(
    NEWS_CATEGORY_LABELS[(locale as Locale) ?? DEFAULT_LOCALE] ??
      NEWS_CATEGORY_LABELS[DEFAULT_LOCALE]
  );
  const category = rawCategory && known.includes(rawCategory) ? rawCategory : null;

  const all = await client.fetch(NEWS_LIST_QUERY, { language: locale }, options);
  const filtered = category
    ? all.filter((article) => article.category === category)
    : all;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(parsePage(params.page), totalPages);
  const start = (page - 1) * PER_PAGE;
  const pageItems = filtered.slice(start, start + PER_PAGE);

  const filters = [
    { value: null, label: t("allCategories") },
    ...known.map((value) => ({
      value,
      label: newsCategoryLabel(locale, value) ?? value,
    })),
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("metaDescription")}
      />
      <Container className="py-10 sm:py-12">
        {/*
          Category filter as links, so it works without JavaScript and every
          filtered view is a shareable, crawlable URL.
        */}
        <nav
          aria-label={t("readingCategory")}
          className="mb-8 border-b border-border pb-4"
        >
          <ul className="flex flex-wrap gap-2">
            {filters.map((filter) => {
              const active = filter.value === category;
              const href = filter.value
                ? `/news?category=${encodeURIComponent(filter.value)}`
                : "/news";
              return (
                <li key={filter.value ?? "all"}>
                  <Link
                    href={href}
                    aria-current={active ? "true" : undefined}
                    className={`inline-flex h-9 items-center rounded-[var(--radius-pill)] border px-4 text-[length:var(--text-sm)] font-semibold transition-colors duration-[var(--motion-fast)] ${
                      active
                        ? "border-brand bg-brand text-brand-contrast"
                        : "border-border-strong text-muted hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {filter.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {pageItems.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <>
            <p className="mb-6 text-[length:var(--text-sm)] text-muted">
              {common("showing", {
                count: pageItems.length,
                total: filtered.length,
              })}
            </p>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((article, i) => (
                <li key={article._id} className="min-w-0">
                  <NewsCard
                    item={article}
                    locale={locale}
                    priority={i < 3 && page === 1}
                    headingLevel={2}
                  />
                </li>
              ))}
            </ul>
            <PaginationControl
              basePath="/news"
              paramName="page"
              currentPage={page}
              totalPages={totalPages}
              searchParams={{ category: category ?? undefined }}
              paginationLabel={common("pagination")}
              previousLabel={common("previousPage")}
              nextLabel={common("nextPage")}
              pageLabel={(item) => common("page", { page: item, total: totalPages })}
            />
          </>
        )}
      </Container>
    </>
  );
}
