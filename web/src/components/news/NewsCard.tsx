import Image from "next/image";
import Link from "next/link";
import { formatDateShort, isoDate } from "@/lib/format";
import { urlForImage } from "@/sanity/image";
import { newsCategoryLabel } from "@/sanity/queries";
import { Badge, Card } from "@/components/ui";

export type NewsCardItem = {
  _id: string;
  title: string | null;
  slug?: { current?: string | null } | null;
  category?: string | null;
  date?: string | null;
  coverImage?: unknown;
};

/**
 * News teaser used on Home (REQ-HOME-004) and the News index
 * (REQ-NEWS-001..003).
 *
 * Composed as one repeated object: fixed 8:5 image ratio, then a metadata row,
 * then the headline — so a row of cards shares edges and baselines regardless
 * of how long the titles run. The whole card is one click target via a
 * stretched overlay on the anchor, which keeps the accessible name to just the
 * headline instead of the card's entire contents.
 *
 * `featured` doubles the card for the lead story: same object, more space.
 */
export function NewsCard({
  item,
  locale,
  priority = false,
  headingLevel = 3,
  featured = false,
}: {
  item: NewsCardItem;
  locale: string;
  priority?: boolean;
  /**
   * 2 when the grid sits directly under the page `h1` (the News index), 3 when
   * it sits under a section heading (Home's "Hot News"), so the document
   * outline never skips a level.
   */
  headingLevel?: 2 | 3;
  featured?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const slug = item.slug?.current;
  const href = slug ? `/news/${slug}` : null;
  const label = newsCategoryLabel(locale, item.category);
  const cover = item.coverImage
    ? urlForImage(item.coverImage as never)
        .width(featured ? 1400 : 800)
        .height(featured ? 875 : 500)
        .fit("crop")
        .url()
    : null;

  return (
    <Card
      as="article"
      variant="raised"
      className="group relative flex h-full flex-col overflow-hidden"
    >
      <div
        className={`relative w-full shrink-0 overflow-hidden bg-surface-strong ${
          featured ? "aspect-[3/2]" : "aspect-[8/5]"
        }`}
      >
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            priority={priority}
            sizes={
              featured
                ? "(max-width: 1024px) 100vw, 60vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            }
            className="object-cover transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.03]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-surface-strong text-border-strong"
          >
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
              <path d="M4 5h16v14H4zM8 13l2.5-3 3 3.5L16 11l2 3H8z" />
            </svg>
          </div>
        )}
      </div>

      <div className={`flex flex-1 flex-col gap-2.5 ${featured ? "p-6 sm:p-8" : "p-5 sm:p-6"}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {label && <Badge tone="accent">{label}</Badge>}
          {item.date && (
            <time
              dateTime={isoDate(item.date)}
              className="eyebrow tabular text-muted"
            >
              {formatDateShort(item.date, locale)}
            </time>
          )}
        </div>
        <Heading
          className={`font-bold leading-snug ${
            featured
              ? "text-[length:var(--text-xl)] sm:text-[length:var(--text-2xl)]"
              : "text-[length:var(--text-base)] sm:text-[length:var(--text-lg)]"
          }`}
        >
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
      </div>
    </Card>
  );
}
