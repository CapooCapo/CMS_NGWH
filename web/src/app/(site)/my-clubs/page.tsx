import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge, ButtonLink, Card, Container, EmptyState, PageHeader, SectionHeading } from "@/components/ui";
import { currentOwner } from "@/server/auth/ownerSession";
import { findClubByOwnerId } from "@/server/repositories/clubs";
import { listRegistrationsForOwner } from "@/server/repositories/registrations";
import type { RegistrationStatus } from "@/server/repositories/types";

export const metadata: Metadata = {
  title: "My Clubs",
  robots: { index: false, follow: false },
};

const statusTone: Record<RegistrationStatus, "warning" | "success" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "muted",
};

function statusLabel(t: Awaited<ReturnType<typeof getTranslations>>, status: RegistrationStatus) {
  return t(`status${status[0].toUpperCase()}${status.slice(1)}` as never);
}

/** Clubs and registration records that belong to the current account only. */
export default async function MyClubsPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/login");

  const [t, locale, club, registrations] = await Promise.all([
    getTranslations("ownerWorkspace"),
    getLocale(),
    findClubByOwnerId(owner.id),
    listRegistrationsForOwner(owner.id),
  ]);
  const formatDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const canRegister = !club && !registrations.some((registration) => registration.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("clubsTitle")}
        lead={t("clubsLead")}
        actions={canRegister ? <ButtonLink href="/clubs/register">{t("registerClub")}</ButtonLink> : undefined}
      />
      <Container className="flex flex-col gap-10 py-10 sm:py-12">
        <section aria-labelledby="owned-clubs">
          <SectionHeading id="owned-clubs">{t("clubsSection")}</SectionHeading>
          {club ? (
            <Card as="article" variant="raised" className="p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow text-muted">{t("club")}</p>
                  <h2 className="mt-1 break-words text-[length:var(--text-xl)] font-extrabold">
                    {club.name}
                  </h2>
                  <p className="mt-1 text-[length:var(--text-sm)] text-muted">{club.province}</p>
                </div>
                <Badge tone="success">{t("statusApproved")}</Badge>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <p className="text-[length:var(--text-sm)] text-muted">
                  {club.approved_at
                    ? t("approvedOn", { date: formatDate.format(new Date(club.approved_at)) })
                    : t("approvedClub")}
                </p>
                <ButtonLink href={`/my-clubs/${club.id}`} tone="outline" size="sm">
                  {t("openClub")}
                </ButtonLink>
              </div>
            </Card>
          ) : (
            <EmptyState
              title={t("noClubsTitle")}
              body={t("noClubsBody")}
              action={canRegister ? <ButtonLink href="/clubs/register">{t("registerClub")}</ButtonLink> : undefined}
            />
          )}
        </section>

        <section aria-labelledby="registration-history">
          <SectionHeading id="registration-history">{t("registrationsSection")}</SectionHeading>
          {registrations.length > 0 ? (
            <ul className="grid gap-4 lg:grid-cols-2">
              {registrations.map((registration) => (
                <li key={registration.id}>
                  <Card as="article" className="h-full p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-[length:var(--text-lg)] font-bold">
                          {registration.club_name}
                        </h3>
                        <p className="mt-1 text-[length:var(--text-sm)] text-muted">
                          {registration.operating_region}
                        </p>
                      </div>
                      <Badge tone={statusTone[registration.status]}>
                        {statusLabel(t, registration.status)}
                      </Badge>
                    </div>
                    <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-[length:var(--text-sm)]">
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                        <dt className="text-muted">{t("submittedOn")}</dt>
                        <dd className="font-semibold">
                          {formatDate.format(new Date(registration.created_at))}
                        </dd>
                      </div>
                      {registration.review_note && (
                        <div>
                          <dt className="text-muted">{t("reviewNote")}</dt>
                          <dd className="mt-1 whitespace-pre-line">{registration.review_note}</dd>
                        </div>
                      )}
                    </dl>
                    {registration.status === "approved" && registration.club_id === club?.id && (
                      <Link
                        href={`/my-clubs/${club.id}`}
                        className="mt-5 inline-flex text-[length:var(--text-sm)] font-semibold text-brand-text hover:underline"
                      >
                        {t("openClub")}
                      </Link>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[length:var(--text-sm)] text-muted">{t("noRegistrations")}</p>
          )}
        </section>
      </Container>
    </>
  );
}
