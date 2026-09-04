import Link from "next/link";
import { formatDateShort, isoDate } from "@/lib/format";
import { newsCategoryLabel } from "@/sanity/queries";
import type { NewsCardItem } from "./NewsCard";

/**
 * Compact headline row — the "more headlines" companion to a featured card.
 *
 * Deliberately not another card: pairing one image-led lead story with a
 * rule-separated text list is how a sports desk stacks a front page, and it
 * removes the height-matching problem that a card grid beside a tall featured
 * card always has (one column ends up stretched over dead space).
 */
export function NewsListItem({
  item,
  locale,
  headingLevel = 3,
}: {
  item: NewsCardItem;
  locale: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const slug = item.slug?.current;
  const href = slug ? `/news/${slug}` : null;
  const label = newsCategoryLabel(locale, item.category);

  return (
    <article className="group relative py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {label && <span className="eyebrow text-accent-strong">{label}</span>}
        {item.date && (
          <time dateTime={isoDate(item.date)} className="eyebrow tabular text-muted">
            {formatDateShort(item.date, locale)}
          </time>
        )}
      </div>
      <Heading className="mt-2 text-[length:var(--text-base)] font-bold leading-snug">
        {href ? (
          <Link
            href={href}
            className="transition-colors duration-[var(--motion-fast)] group-hover:text-brand-text-text"
          >
            {item.title}
            <span aria-hidden="true" className="absolute inset-0" />
          </Link>
        ) : (
          item.title
        )}
      </Heading>
    </article>
  );
}
