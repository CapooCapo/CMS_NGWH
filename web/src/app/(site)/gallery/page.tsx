import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { GalleryGrid, type GalleryPhoto } from "@/components/gallery/GalleryGrid";
import { PaginationControl } from "@/components/PaginationControl";
import { PortableTextBody } from "@/components/PortableTextBody";
import {
  Container,
  EmptyState,
  Eyebrow,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { absoluteUrl } from "@/lib/site";
import { client } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import { GALLERY_ITEMS_QUERY } from "@/sanity/queries";

const options = { next: { revalidate: 30 } };

// Page sizes are part of the already-validated behaviour of this route and are
// intentionally unchanged: 6 photos per page for the two photo sections and one
// card at a time for MVP Spotlight.
const PHOTOS_PER_PAGE = 6;
const MVP_PER_PAGE = 1;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("gallery");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/gallery") },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      url: absoluteUrl("/gallery"),
    },
  };
}

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function paginate<T>(items: T[], page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * perPage;
  return {
    pageItems: items.slice(start, start + perPage),
    totalPages,
    currentPage,
  };
}

export default async function GalleryPage({
  searchParams,
}: PageProps<"/gallery">) {
  const locale = await getLocale();
  const t = await getTranslations("gallery");
  const resolvedSearchParams = await searchParams;

  const items = await client.fetch(
    GALLERY_ITEMS_QUERY,
    { language: locale },
    options
  );

  const byCategory = (category: string) =>
    items.filter((item) => item.category === category);

  const hallOfGlory = byCategory("hall-of-glory");
  const mvpSpotlight = byCategory("mvp-spotlight");
  const behindTheScenes = byCategory("behind-the-scenes");

  // Photos are flattened across items, newest item first, so a section reads as
  // one album rather than a list of albums.
  const flatten = (source: typeof items): GalleryPhoto[] =>
    source.flatMap((item, itemIndex) =>
      (item.photos ?? []).map((photo, photoIndex) => ({
        key: photo._key ?? `${item._id}-${itemIndex}-${photoIndex}`,
        thumbUrl: urlForImage(photo as never).width(600).height(450).fit("crop").url(),
        fullUrl: urlForImage(photo as never).width(1800).fit("max").url(),
        alt: (photo as { alt?: string }).alt ?? item.title ?? "",
        caption: item.title ?? null,
      }))
    );

  const hallOfGloryPhotos = flatten(hallOfGlory);
  const behindTheScenesPhotos = flatten(behindTheScenes);

  const hogPagination = paginate(
    hallOfGloryPhotos,
    parsePage(resolvedSearchParams.hogPage),
    PHOTOS_PER_PAGE
  );
  const btsPagination = paginate(
    behindTheScenesPhotos,
    parsePage(resolvedSearchParams.btsPage),
    PHOTOS_PER_PAGE
  );
  const mvpPagination = paginate(
    mvpSpotlight,
    parsePage(resolvedSearchParams.mvpPage),
    MVP_PER_PAGE
  );

  const baseSearchParams = {
    hogPage:
      typeof resolvedSearchParams.hogPage === "string"
        ? resolvedSearchParams.hogPage
        : undefined,
    mvpPage:
      typeof resolvedSearchParams.mvpPage === "string"
        ? resolvedSearchParams.mvpPage
        : undefined,
    btsPage:
      typeof resolvedSearchParams.btsPage === "string"
        ? resolvedSearchParams.btsPage
        : undefined,
  };

  const lightboxLabels = {
    open: t("openImage"),
    close: t("closeImage"),
    previous: t("previousImage"),
    next: t("nextImage"),
    counter: t("imageCounter", { index: "{index}", total: "{total}" }),
  };

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("metaDescription")}
      />
      <Container className="flex flex-col gap-14 py-10 sm:py-12">
        {/* REQ-GALLERY-001 — Championship Moments Library (photo slice). */}
        <section aria-labelledby="hall-of-glory">
          <SectionHeading id="hall-of-glory">{t("hallOfGlory")}</SectionHeading>
          {hogPagination.pageItems.length === 0 ? (
            <EmptyState title={t("emptyHallOfGlory")} />
          ) : (
            <>
              <GalleryGrid
                photos={hogPagination.pageItems}
                labels={lightboxLabels}
                columns="three"
                priority
              />
              <PaginationControl
                basePath="/gallery"
                paramName="hogPage"
                currentPage={hogPagination.currentPage}
                totalPages={hogPagination.totalPages}
                searchParams={baseSearchParams}
                previousLabel={t("previousPage")}
                nextLabel={t("nextPage")}
              />
            </>
          )}
        </section>

        {/* REQ-GALLERY-002 — MVP Spotlight. */}
        <section aria-labelledby="mvp-spotlight">
          <SectionHeading id="mvp-spotlight">{t("mvpSpotlight")}</SectionHeading>
          {mvpPagination.pageItems.length === 0 ? (
            <EmptyState title={t("emptyMvpSpotlight")} />
          ) : (
            <>
              {mvpPagination.pageItems.map((item) => {
                const photo = item.photos?.[0];
                const src = photo
                  ? urlForImage(photo as never).width(800).height(800).fit("crop").url()
                  : null;
                return (
                  <article
                    key={item._id}
                    className="on-court flex flex-col gap-0 overflow-hidden rounded-[var(--radius-md)] bg-ink text-ink-foreground sm:flex-row"
                  >
                    {src && (
                      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-ink-raised sm:w-64 lg:w-80">
                        <Image
                          src={src}
                          alt={(photo as { alt?: string })?.alt ?? item.title ?? ""}
                          fill
                          sizes="(max-width: 640px) 100vw, 256px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 p-6 sm:p-8">
                      <Eyebrow tone="onCourt" className="mb-2.5">
                        {t("mvpSpotlight")}
                      </Eyebrow>
                      <h3 className="text-[length:var(--text-2xl)] font-black leading-tight">
                        {item.title}
                      </h3>
                      <div className="mt-4 text-[length:var(--text-sm)] leading-relaxed text-ink-muted">
                        <PortableTextBody value={item.body} />
                      </div>
                    </div>
                  </article>
                );
              })}
              <PaginationControl
                basePath="/gallery"
                paramName="mvpPage"
                currentPage={mvpPagination.currentPage}
                totalPages={mvpPagination.totalPages}
                searchParams={baseSearchParams}
                previousLabel={t("previousPage")}
                nextLabel={t("nextPage")}
              />
            </>
          )}
        </section>

        {/* REQ-GALLERY-003 — Behind-the-Scenes Stories. */}
        <section aria-labelledby="behind-the-scenes">
          <SectionHeading id="behind-the-scenes">
            {t("behindTheScenes")}
          </SectionHeading>
          {btsPagination.pageItems.length === 0 ? (
            <EmptyState title={t("emptyBehindTheScenes")} />
          ) : (
            <>
              <GalleryGrid
                photos={btsPagination.pageItems}
                labels={lightboxLabels}
                columns="three"
              />
              <PaginationControl
                basePath="/gallery"
                paramName="btsPage"
                currentPage={btsPagination.currentPage}
                totalPages={btsPagination.totalPages}
                searchParams={baseSearchParams}
                previousLabel={t("previousPage")}
                nextLabel={t("nextPage")}
              />
            </>
          )}
        </section>
      </Container>
    </>
  );
}
