import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { PortableTextBody } from "@/components/PortableTextBody";
import {
  Container,
  EmptyState,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { absoluteUrl } from "@/lib/site";
import { client } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import { ABOUT_PAGE_QUERY } from "@/sanity/queries";

const options = { next: { revalidate: 30 } };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/about") },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      url: absoluteUrl("/about"),
    },
  };
}

/**
 * REQ-ABOUT-001 (brand story / vision / mission), REQ-ABOUT-002 (tournament
 * system) and REQ-ABOUT-003 (organizing committee & partners).
 *
 * REQ-ABOUT-002 is PARTIALLY_READY: the *copy* naming specific technical,
 * refereeing and international standards is blocked on OQ-006. The section is
 * rendered from whatever the Studio holds, so answering OQ-006 is a content
 * edit rather than a code change.
 */
export default async function AboutPage() {
  const locale = await getLocale();
  const t = await getTranslations("about");
  const about = await client.fetch(ABOUT_PAGE_QUERY, { language: locale }, options);

  if (!about) {
    return (
      <>
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
        <Container width="prose" className="py-12">
          <EmptyState title={t("empty")} />
        </Container>
      </>
    );
  }

  // Brand Story renders above the vision/mission pair; these two follow it.
  const proseSections: { id: string; heading: string; value: unknown }[] = [
    {
      id: "tournament-system",
      heading: t("tournamentSystem"),
      value: about.tournamentSystem,
    },
    {
      id: "organizer-partners",
      heading: t("organizerAndPartners"),
      value: about.organizerAndPartners,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("metaDescription")}
      />

      <Container width="prose" className="flex flex-col gap-12 py-10 sm:py-12">
        {Array.isArray(about.brandStory) && about.brandStory.length > 0 && (
          <section aria-labelledby="brand-story">
            <SectionHeading id="brand-story">{t("brandStory")}</SectionHeading>
            <div className="text-[length:var(--text-lg)] leading-[1.75]">
              <PortableTextBody value={about.brandStory} />
            </div>
          </section>
        )}

        {/* Vision and mission are plain text fields, so they are rendered as
            definition-style blocks rather than through Portable Text. */}
        {(about.vision || about.mission) && (
          <div className="grid gap-px overflow-hidden rounded-[var(--radius-sm)] border border-border bg-border sm:grid-cols-2">
            {about.vision && (
              <section aria-labelledby="vision" className="bg-surface-sunken p-6">
                <h2 id="vision" className="eyebrow mb-3 text-accent-strong">
                  {t("vision")}
                </h2>
                <p className="whitespace-pre-line text-[length:var(--text-base)] leading-relaxed">
                  {about.vision}
                </p>
              </section>
            )}
            {about.mission && (
              <section aria-labelledby="mission" className="bg-surface-sunken p-6">
                <h2 id="mission" className="eyebrow mb-3 text-accent-strong">
                  {t("mission")}
                </h2>
                {/*
                  `whitespace-pre-line` keeps the numbered mission list on its
                  own lines: it is a plain `text` field, so the newlines would
                  otherwise collapse into one run-on paragraph.
                */}
                <p className="whitespace-pre-line text-[length:var(--text-base)] leading-relaxed">
                  {about.mission}
                </p>
              </section>
            )}
          </div>
        )}

        {proseSections.map(
          (section) =>
            Array.isArray(section.value) &&
            section.value.length > 0 && (
              <section key={section.id} aria-labelledby={section.id}>
                <SectionHeading id={section.id}>{section.heading}</SectionHeading>
                <div className="text-[length:var(--text-base)] leading-relaxed">
                  <PortableTextBody value={section.value} />
                </div>
              </section>
            )
        )}
      </Container>

      {Array.isArray(about.images) && about.images.length > 0 && (
        <Container className="pb-12">
          <SectionHeading>{t("gallery")}</SectionHeading>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {about.images.map((image, index) => (
              <li
                key={image._key ?? index}
                className={`relative overflow-hidden rounded-[var(--radius-sm)] bg-surface-strong ${
                  index === 0
                    ? "col-span-2 aspect-[8/5] lg:col-span-3 lg:row-span-2"
                    : "aspect-[4/3]"
                }`}
              >
                <Image
                  src={urlForImage(image as never).width(600).height(450).fit("crop").url()}
                  alt={image.alt ?? ""}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
              </li>
            ))}
          </ul>
        </Container>
      )}

      {/* REQ-ABOUT-003 — partners. */}
      {Array.isArray(about.partners) && about.partners.length > 0 && (
        <Container className="pb-16">
          <SectionHeading>{t("partners")}</SectionHeading>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-sm)] border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
            {about.partners.map((partner) => (
              <li
                key={partner._id}
                className="flex flex-col items-center gap-3 bg-surface p-6 text-center transition-colors duration-[var(--motion-fast)] hover:bg-surface-sunken"
              >
                {partner.logo && (
                  <div className="relative h-16 w-16 overflow-hidden rounded-[var(--radius-sm)] bg-surface-strong">
                    <Image
                      src={urlForImage(partner.logo as never).width(200).height(200).fit("crop").url()}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  </div>
                )}
                <span className="text-[length:var(--text-sm)] font-bold leading-snug">
                  {partner.name}
                </span>
                {partner.role && (
                  <span className="text-[length:var(--text-xs)] text-muted">
                    {partner.role}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Container>
      )}
    </>
  );
}
