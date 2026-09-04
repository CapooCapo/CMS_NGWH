import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/contact/ContactForm";
import { PortableTextBody } from "@/components/PortableTextBody";
import {
  Card,
  Container,
  EmptyState,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { absoluteUrl } from "@/lib/site";
import { client } from "@/sanity/client";
import { CONTACT_PAGE_QUERY } from "@/sanity/queries";

const options = { next: { revalidate: 30 } };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/contact") },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      url: absoluteUrl("/contact"),
    },
  };
}

/**
 * REQ-CONTACT-001 (office info, hotline, support emails) and REQ-CONTACT-002
 * (feedback form).
 *
 * The two halves are deliberately separated as the task requires: the office
 * details are editable CMS content from Sanity, while form submissions are
 * transactional and go to PostgreSQL.
 */
export default async function ContactPage() {
  const locale = await getLocale();
  const [t, common, errors] = await Promise.all([
    getTranslations("contact"),
    getTranslations("common"),
    getTranslations("errors"),
  ]);

  const contact = await client.fetch(
    CONTACT_PAGE_QUERY,
    { language: locale },
    options
  );

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("metaDescription")}
      />
      <Container className="grid gap-10 py-10 sm:py-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <section aria-labelledby="contact-details">
          <SectionHeading id="contact-details">{t("office")}</SectionHeading>
          {!contact ? (
            <EmptyState title={t("empty")} />
          ) : (
            <Card className="bg-surface-sunken p-6">
              <dl className="flex flex-col gap-6 text-[length:var(--text-sm)]">
                {contact.officeName && (
                  <div>
                    <dt className="eyebrow mb-1.5 text-muted">{t("office")}</dt>
                    <dd className="font-display text-[length:var(--text-base)] font-bold">
                      {contact.officeName}
                    </dd>
                    {contact.address && (
                      <dd className="mt-1.5 whitespace-pre-line leading-relaxed text-muted">
                        {contact.address}
                      </dd>
                    )}
                  </div>
                )}
                {contact.hotline && (
                  <div>
                    <dt className="eyebrow mb-1.5 text-muted">{t("hotline")}</dt>
                    <dd>
                      <a
                        href={`tel:${contact.hotline.replace(/\s+/g, "")}`}
                        className="font-display tabular text-[length:var(--text-lg)] font-bold text-brand-text hover:underline"
                      >
                        {contact.hotline}
                      </a>
                    </dd>
                  </div>
                )}
                {Array.isArray(contact.emails) && contact.emails.length > 0 && (
                  <div>
                    <dt className="eyebrow mb-1.5 text-muted">{t("email")}</dt>
                    <dd className="flex flex-col gap-2">
                      {contact.emails.map((entry) => (
                        <span key={entry.address ?? entry.label}>
                          {entry.label && (
                            <span className="text-muted">{entry.label}: </span>
                          )}
                          {entry.address && (
                            <a
                              href={`mailto:${entry.address}`}
                              className="hover:underline"
                            >
                              {entry.address}
                            </a>
                          )}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {contact.officeHours && (
                  <div>
                    <dt className="eyebrow mb-1.5 text-muted">{t("officeHours")}</dt>
                    <dd>{contact.officeHours}</dd>
                  </div>
                )}
              </dl>
              {contact.note && (
                <div className="mt-6 border-t border-border-strong pt-5 text-[length:var(--text-sm)] leading-relaxed text-muted">
                  <PortableTextBody value={contact.note} />
                </div>
              )}
            </Card>
          )}
        </section>

        <section aria-labelledby="contact-form">
          <SectionHeading id="contact-form">{t("formTitle")}</SectionHeading>
          {contact?.formIntro && (
            <p className="mb-6 max-w-[58ch] text-[length:var(--text-sm)] leading-relaxed text-muted">
              {contact.formIntro}
            </p>
          )}
          <ContactForm
            labels={{
              optional: common("optional"),
              unexpected: errors("unexpected"),
              again: t("formTitle"),
            }}
          />
        </section>
      </Container>
    </>
  );
}
