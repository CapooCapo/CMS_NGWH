import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ClubMembersTable } from "@/components/admin/ClubMembersTable";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { ClubCrest } from "@/components/clubs/ClubCrest";
import {
  Badge,
  ButtonLink,
  Container,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { RegistrationStatusPanel } from "@/components/clubs/RegistrationStatusPanel";
import { ClubDeletionControl } from "@/components/owner/ClubDeletionControl";
import { listClubMembers } from "@/server/repositories/clubs";
import { listRegistrationDocumentsForClub } from "@/server/repositories/registrations";
import {
  ownerDisplayName,
  resolveOwnerWorkspace,
} from "@/server/services/ownerWorkspace";
import type { ClubMemberRole } from "@/server/repositories/types";
import { SOCIAL_LINK_FIELDS } from "@/lib/clubSocialLinks";
import { PLAYER_POSITIONS, STAFF_ROLES } from "@/lib/clubMembers";

export const metadata: Metadata = {
  title: "My Club",
  robots: { index: false, follow: false },
};

/**
 * "My Club" — the Club Owner dashboard.
 *
 * Loads the authenticated owner's *own* club and nothing else:
 * `findClubByOwnerId(owner.id)` is the entire "which club" decision, so there
 * is no id in this route to tamper with, and no multi-club selector (this
 * product's ownership model is one owner → at most one club).
 *
 * Structured to mirror the public club page's sections (Achievements /
 * Roster / Coaching staff / Contact & social / Documents) so the owner sees
 * their data laid out the same way a visitor will, with the same real empty
 * states — reusing the `clubs` i18n namespace for exactly that reason.
 */
export default async function MyClubPage() {
  const [locale, t, myClub, register] = await Promise.all([
    getLocale(),
    getTranslations("clubs"),
    getTranslations("myClub"),
    getTranslations("register"),
  ]);

  let workspace;
  try {
    workspace = await resolveOwnerWorkspace();
  } catch {
    return (
      <Container className="py-12">
        <ErrorState title={myClub("loadError")} />
      </Container>
    );
  }

  if (workspace.state === "anonymous") redirect("/login?next=%2Fmy-club");

  /*
   * Everything short of owning a club is a *state of the workflow*, not an
   * error: the person may not have registered yet, may be waiting on review,
   * or may have been turned down. Each says where they are and what the next
   * action is, rather than the single "no club assigned" dead end this page
   * used to show for all three.
   */
  if (workspace.state !== "approved") {
    const registerCta = (
      <ButtonLink href="/clubs/register">{myClub("registerClub")}</ButtonLink>
    );
    return (
      <>
        <PageHeader eyebrow={myClub("eyebrow")} title={myClub("title")} />
        <Container width="narrow" className="py-10 sm:py-12">
          {workspace.state === "noRegistration" && (
            <EmptyState
              title={myClub("noRegistrationTitle")}
              body={myClub("noRegistrationBody")}
              action={registerCta}
            />
          )}
          {workspace.state === "pending" && (
            <RegistrationStatusPanel
              status="pending"
              registration={workspace.registration}
              labels={{
                title: myClub("pendingTitle"),
                body: myClub("pendingBody"),
                badge: register("statusPendingBadge"),
                reason: register("statusReason"),
                submittedOn: register("submittedOn"),
                club: register("statusClub"),
              }}
              locale={locale}
            />
          )}
          {workspace.state === "rejected" && (
            <RegistrationStatusPanel
              status="rejected"
              registration={workspace.registration}
              labels={{
                title: myClub("rejectedTitle"),
                body: myClub("rejectedBody"),
                badge: register("statusRejectedBadge"),
                reason: register("statusReason"),
                submittedOn: register("submittedOn"),
                club: register("statusClub"),
              }}
              locale={locale}
              action={registerCta}
            />
          )}
        </Container>
      </>
    );
  }

  const { owner, club } = workspace;

  const [members, documents] = await Promise.all([
    listClubMembers(club.id),
    listRegistrationDocumentsForClub(club.id),
  ]);
  const byRole = (role: ClubMemberRole) => members.filter((m) => m.member_role === role);
  const players = byRole("player");
  const coachStaff = [...byRole("coach"), ...byRole("staff")];
  // Created by approval from the registrant's own account, so it is normally
  // this very session's person — but read from the club, not the session, so
  // an admin-reassigned club still shows whoever actually holds the role.
  const headCoach = members.find((m) => m.is_head_coach) ?? null;

  const achievements =
    locale === "vi"
      ? club.achievements_vi || club.achievements_en
      : club.achievements_en || club.achievements_vi;
  const socials = Object.entries(club.social_links ?? {});

  const memberLabels = {
    caption: myClub("navLabel"),
    number: myClub("tableNumber"),
    name: myClub("tableName"),
    role: myClub("tableRole"),
    position: myClub("tablePosition"),
    born: myClub("tableBorn"),
    actions: myClub("tableActions"),
    edit: myClub("tableEdit"),
    cancel: myClub("tableCancel"),
    delete: myClub("tableDelete"),
    // A plain string with a literal `{name}` token, not a function — this
    // object crosses into the `"use client"` ClubMembersTable, which cannot
    // receive a function prop from a Server Component.
    deleteConfirmTemplate: myClub("tableDeleteConfirm", { name: "{name}" }),
    saveChanges: myClub("tableSave"),
    fullName: myClub("tableFullName"),
    roleLabels: {
      player: myClub("tablePlayer"),
      coach: myClub("tableCoach"),
      staff: myClub("tableStaff"),
    },
    positionLabels: {
      PG: myClub("positionPG"),
      SG: myClub("positionSG"),
      SF: myClub("positionSF"),
      PF: myClub("positionPF"),
      C: myClub("positionC"),
      HEAD_COACH: myClub("staffRoleHeadCoach"),
      ASSISTANT_COACH: myClub("staffRoleAssistantCoach"),
      TEAM_MANAGER: myClub("staffRoleTeamManager"),
      TEAM_DOCTOR: myClub("staffRoleTeamDoctor"),
      PHYSIOTHERAPIST: myClub("staffRolePhysiotherapist"),
      STATISTICIAN: myClub("staffRoleStatistician"),
      INTERPRETER: myClub("staffRoleInterpreter"),
    },
    headCoach: myClub("headCoachBadge"),
  };

  const addMemberFields = (defaultRole: ClubMemberRole) =>
    [
      { name: "fullName", label: memberLabels.fullName, required: true as const },
      {
        name: "memberRole",
        label: memberLabels.role,
        type: "select" as const,
        required: true as const,
        defaultValue: defaultRole,
        options: [
          { value: "player", label: memberLabels.roleLabels.player },
          { value: "coach", label: memberLabels.roleLabels.coach },
          { value: "staff", label: memberLabels.roleLabels.staff },
        ],
      },
      { name: "shirtNumber", label: memberLabels.number, type: "number" as const, min: 0, max: 99 },
      {
        name: "position",
        label: memberLabels.position,
        type: "select" as const,
        options: (defaultRole === "player"
          ? PLAYER_POSITIONS
          : STAFF_ROLES.filter((role) => role !== "HEAD_COACH")
        ).map((value) => ({ value, label: memberLabels.positionLabels[value] })),
      },
      { name: "birthYear", label: memberLabels.born, type: "number" as const, min: 1900, max: 2200 },
    ];

  return (
    <>
      <PageHeader
        eyebrow={myClub("eyebrow")}
        title={club.name}
        lead={club.province}
        actions={
          club.is_approved ? (
            <>
              <ButtonLink href={`/clubs/${club.slug}`} tone="outline">
                {myClub("viewPublicPage")}
              </ButtonLink>
              <ClubDeletionControl
                clubId={club.id}
                requested={Boolean(club.deletion_requested_at)}
                labels={{
                  open: myClub("deleteClub"),
                  title: myClub("deleteClub"),
                  body: myClub("deleteClubBody"),
                  confirmationPrompt: myClub("deleteClubConfirmation"),
                  cancel: myClub("deleteClubCancel"),
                  confirm: myClub("deleteClubConfirm"),
                  unavailable: myClub("deleteClubUnavailable"),
                  failed: myClub("deleteClubFailed"),
                  requested: myClub("deleteClubRequested"),
                  cancelRequest: myClub("cancelDeleteClubRequest"),
                }}
              />
            </>
          ) : undefined
        }
      />

      <Container className="flex flex-col gap-10 py-10 sm:py-12">
        {/* Club Header Surface */}
        <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-[var(--shadow-xs)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <ClubCrest name={club.name} logoUrl={club.logo_url} size={68} />
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-[length:var(--text-xl)] font-bold sm:text-[length:var(--text-2xl)]">
                    {club.name}
                  </h2>
                  <Badge tone={club.is_approved ? "success" : "warning"}>
                    {club.is_approved ? "Published" : "Pending publication"}
                  </Badge>
                </div>
                <p className="mt-1 text-[length:var(--text-sm)] text-muted">
                  {club.province} {club.founding_year ? `· ${t("founded")} ${club.founding_year}` : ""}
                </p>
              </div>
            </div>
            {club.is_approved && (
              <ButtonLink href={`/clubs/${club.slug}`} tone="outline" size="sm">
                {myClub("viewPublicPage")}
              </ButtonLink>
            )}
          </div>

          {/* Who this person is on this club. The registrant becomes both on
              approval, so these are usually the same name twice — shown as
              two rows anyway because they are two distinct responsibilities
              and an admin can later hand the head-coach role to someone
              else. */}
          <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div>
              <dt className="eyebrow text-muted">{myClub("roleOwner")}</dt>
              <dd className="mt-1 text-[length:var(--text-sm)] font-semibold">
                {ownerDisplayName(owner)}
              </dd>
            </div>
            {headCoach && (
              <div>
                <dt className="eyebrow text-muted">{myClub("roleHeadCoach")}</dt>
                <dd className="mt-1 text-[length:var(--text-sm)] font-semibold">
                  {headCoach.full_name}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Club Information */}
        <section aria-labelledby="my-club-info">
          <SectionHeading id="my-club-info">{myClub("clubInformation")}</SectionHeading>
          <Disclosure label={myClub("editClub")}>
            <JsonForm
              action="/api/owner/club"
              method="PATCH"
              submitLabel={myClub("saveChanges")}
              fields={[
                { name: "name", label: myClub("fieldName"), required: true, defaultValue: club.name },
                { name: "province", label: myClub("fieldProvince"), required: true, defaultValue: club.province },
                {
                  name: "foundingYear",
                  label: myClub("fieldFoundingYear"),
                  type: "number",
                  min: 1800,
                  max: 2200,
                  defaultValue: club.founding_year,
                },
                { name: "logoUrl", label: myClub("fieldLogoUrl"), type: "url", defaultValue: club.logo_url },
                { name: "websiteUrl", label: myClub("fieldWebsite"), type: "url", defaultValue: club.website_url },
                { name: "contactEmail", label: myClub("fieldContactEmail"), type: "email", defaultValue: club.contact_email },
                { name: "contactPhone", label: myClub("fieldContactPhone"), type: "tel", defaultValue: club.contact_phone },
                {
                  name: "socialLinks",
                  label: myClub("fieldSocialLinks"),
                  type: "urlgroup",
                  keys: SOCIAL_LINK_FIELDS,
                  colSpan: 2,
                  defaultValue: club.social_links,
                },
              ]}
            />
          </Disclosure>
        </section>

        {/* Achievements */}
        <section aria-labelledby="my-club-achievements">
          <SectionHeading id="my-club-achievements">{t("achievements")}</SectionHeading>
          {achievements ? (
            <div className="rounded-[var(--radius-lg)] border border-border/80 bg-surface p-6 shadow-[var(--shadow-xs)]">
              <p className="max-w-[68ch] whitespace-pre-line text-[length:var(--text-base)] leading-relaxed">
                {achievements}
              </p>
            </div>
          ) : (
            <p className="text-[length:var(--text-sm)] text-muted">{t("noAchievements")}</p>
          )}
        </section>

        {/* Roster */}
        <section aria-labelledby="my-club-roster">
          <SectionHeading id="my-club-roster" action={<span className="text-[length:var(--text-sm)] font-semibold text-muted">{players.length}</span>}>
            {t("roster")}
          </SectionHeading>
          <div className="flex flex-col gap-4">
            <ClubMembersTable
              actionBase="/api/owner/club/members"
              members={players}
              emptyLabel={t("noRoster")}
              labels={memberLabels}
            />
            <Disclosure label={myClub("addAthlete")}>
              <JsonForm
                action="/api/owner/club/members"
                submitLabel={myClub("tableSave")}
                compact
                fields={addMemberFields("player")}
              />
            </Disclosure>
          </div>
        </section>

        {/* Coaching staff */}
        <section aria-labelledby="my-club-staff">
          <SectionHeading id="my-club-staff" action={<span className="text-[length:var(--text-sm)] font-semibold text-muted">{coachStaff.length}</span>}>
            {t("coachingStaff")}
          </SectionHeading>
          <div className="flex flex-col gap-4">
            <ClubMembersTable
              actionBase="/api/owner/club/members"
              members={coachStaff}
              emptyLabel={t("noCoachingStaff")}
              labels={memberLabels}
            />
            <Disclosure label={myClub("addStaff")}>
              <JsonForm
                action="/api/owner/club/members"
                submitLabel={myClub("tableSave")}
                compact
                fields={addMemberFields("coach")}
              />
            </Disclosure>
          </div>
        </section>

        {/* Contact & social */}
        <section aria-labelledby="my-club-contact">
          <SectionHeading id="my-club-contact">{t("contactSocial")}</SectionHeading>
          {/* `min-w-0` on the cards: a grid item defaults to `min-width:auto`,
              so a long unbreakable token inside (an email address, a URL)
              stretches the card past the viewport and scrolls the whole page
              sideways on a phone. The links below also need `break-all`. */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0 rounded-[var(--radius-lg)] border border-border/80 bg-surface p-6 shadow-[var(--shadow-xs)]">
              <h3 className="eyebrow mb-3 text-muted">{t("contactInfo")}</h3>
              {club.contact_email || club.contact_phone || club.website_url ? (
                <dl className="flex flex-col gap-2.5 text-sm">
                  {club.contact_email && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted">Email:</span>
                      <a href={`mailto:${club.contact_email}`} className="break-all font-semibold hover:underline">
                        {club.contact_email}
                      </a>
                    </div>
                  )}
                  {club.contact_phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted">{t("phone")}:</span>
                      <span className="font-semibold">{club.contact_phone}</span>
                    </div>
                  )}
                  {club.website_url && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted">{t("website")}:</span>
                      <a href={club.website_url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-brand-text-text hover:underline">
                        {club.website_url}
                      </a>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-[length:var(--text-sm)] text-muted">{t("noContact")}</p>
              )}
            </div>
            <div className="min-w-0 rounded-[var(--radius-lg)] border border-border/80 bg-surface p-6 shadow-[var(--shadow-xs)]">
              <h3 className="eyebrow mb-3 text-muted">{t("social")}</h3>
              {socials.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {socials.map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border-strong/80 bg-surface-sunken/60 px-3 py-1.5 text-sm font-semibold capitalize hover:border-foreground/40 hover:bg-surface"
                    >
                      <span>{key}</span>
                      <span aria-hidden="true" className="text-muted text-xs">↗</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[length:var(--text-sm)] text-muted">{t("noSocial")}</p>
              )}
            </div>
          </div>
        </section>

        {/* Documents */}
        <section aria-labelledby="my-club-documents">
          <SectionHeading id="my-club-documents">{t("documents")}</SectionHeading>
          {documents.length > 0 ? (
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-xs)]">
              {documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold">{doc.filename}</span>
                    <Badge tone={doc.is_public ? "success" : "muted"}>
                      {doc.is_public ? myClub("documentPublic") : myClub("documentPrivate")}
                    </Badge>
                  </div>
                  <Link
                    href={`/api/owner/club/documents/${doc.id}`}
                    className="text-sm font-semibold text-brand-text-text hover:underline"
                  >
                    {t("viewDocument")}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[length:var(--text-sm)] text-muted">{t("noDocuments")}</p>
          )}
        </section>
      </Container>
    </>
  );
}
