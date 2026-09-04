import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { RegistrationForm } from "@/components/clubs/RegistrationForm";
import {
  RegistrationAuthGate,
  RegistrationStatusPanel,
} from "@/components/clubs/RegistrationStatusPanel";
import { ButtonLink, Container, PageHeader } from "@/components/ui";
import { absoluteUrl } from "@/lib/site";
import { resolveOwnerWorkspace } from "@/server/services/ownerWorkspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("register");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/clubs/register") },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      url: absoluteUrl("/clubs/register"),
    },
  };
}

/**
 * REQ-REG-001 — the registration portal, which is now **authenticated**.
 *
 * Four states, all decided server-side from the session by
 * `resolveOwnerWorkspace()`:
 *
 *   anonymous   → explain, offer Sign in / Create an account
 *   no reg. yet → the form
 *   pending     → "under review", no form (one pending registration per account)
 *   rejected    → the reason, plus the form again so they can re-apply
 *   approved    → confirmation + a link into the owned-club detail page
 *
 * The signed-out state is a *courtesy*, not the security boundary: hiding the
 * form stops nobody from POSTing, so `POST /api/registrations` does its own
 * `currentOwner()` check and 401s. Both are required; neither substitutes for
 * the other.
 */
export default async function ClubRegistrationPage() {
  const [locale, t, common, errors, workspace] = await Promise.all([
    getLocale(),
    getTranslations("register"),
    getTranslations("common"),
    getTranslations("errors"),
    resolveOwnerWorkspace(),
  ]);

  const formLabels = {
    optional: common("optional"),
    unexpected: errors("unexpected"),
    clubSection: t("clubSection"),
    repSection: t("repSection"),
    alreadyPending: t("alreadyPending"),
  };

  const statusLabels = (kind: "Pending" | "Approved" | "Rejected") => ({
    title: t(`status${kind}Title`),
    body: t(`status${kind}Body`),
    badge: t(`status${kind}Badge`),
    reason: t("statusReason"),
    submittedOn: t("submittedOn"),
    club: t("statusClub"),
  });

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("intro")} />
      <Container width="narrow" className="py-10 sm:py-12">
        {workspace.state === "anonymous" && (
          <RegistrationAuthGate
            labels={{
              title: t("authRequiredTitle"),
              body: t("authRequiredBody"),
              signIn: t("signIn"),
              createAccount: t("createAccount"),
              next: "/clubs/register",
            }}
          />
        )}

        {workspace.state === "noRegistration" && (
          <RegistrationForm labels={formLabels} />
        )}

        {workspace.state === "pending" && (
          <RegistrationStatusPanel
            status="pending"
            registration={workspace.registration}
            labels={statusLabels("Pending")}
            locale={locale}
          />
        )}

        {workspace.state === "approved" && (
          <RegistrationStatusPanel
            status="approved"
            registration={workspace.registration}
            labels={statusLabels("Approved")}
            locale={locale}
            action={<ButtonLink href={`/my-clubs/${workspace.club.id}`}>{t("manageClub")}</ButtonLink>}
          />
        )}

        {workspace.state === "rejected" && (
          <div className="flex flex-col gap-8">
            <RegistrationStatusPanel
              status="rejected"
              registration={workspace.registration}
              labels={statusLabels("Rejected")}
              locale={locale}
            />
            {/* The form again, pre-emptively: "you may re-apply" is only true
                if re-applying is one scroll away. */}
            <RegistrationForm labels={formLabels} />
          </div>
        )}
      </Container>
    </>
  );
}
