import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClubCrest } from "@/components/clubs/ClubCrest";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Breadcrumbs,
  Container,
  PageHeader,
  SectionHeading,
  StatList,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { absoluteUrl } from "@/lib/site";
import { findClubBySlug, listClubMembers } from "@/server/repositories/clubs";
import { listPublicClubDocuments } from "@/server/repositories/registrations";
import type { ClubMember } from "@/server/repositories/types";
import type { ClubMemberPosition } from "@/lib/clubMembers";
import { clubSocialLinks, groupClubMembers, localizedClubAchievements } from "@/lib/clubView";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * REQ-CLUB-003..006 — public club profile.
 *
 * BR-001: `findClubBySlug(slug, true)` only ever returns an approved club, so
 * an unapproved profile is a 404 here rather than a hidden page — the URL leaks
 * nothing about pending registrations.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let club = null;
  try {
    club = await findClubBySlug(slug, true);
  } catch {
    // Metadata must not throw.
  }
  if (!club) return { title: "Not found", robots: { index: false } };

  const description = `${club.name} — ${club.province}`;
  return {
    title: club.name,
    description,
    alternates: { canonical: absoluteUrl(`/clubs/${slug}`) },
    openGraph: {
      title: club.name,
      description,
      url: absoluteUrl(`/clubs/${slug}`),
      images: club.logo_url ? [club.logo_url] : undefined,
    },
  };
}

function RosterTable({
  members,
  heading,
  labels,
}: {
  members: readonly ClubMember[];
  heading: string;
  labels: {
    number: string;
    name: string;
    position: string;
    birthYear: string;
    headCoach: string;
    positionLabels: Record<ClubMemberPosition, string>;
  };
}) {
  if (members.length === 0) return null;
  const showNumbers = members.some((m) => m.shirt_number !== null);
  return (
    <div>
      <h3 className="eyebrow mb-3 text-muted">{heading}</h3>
      <Table
        caption={heading}
        minWidth="30rem"
        head={
          <>
            {showNumbers && (
              <Th align="right" className="w-14">
                {labels.number}
              </Th>
            )}
            <Th sticky>{labels.name}</Th>
            <Th>{labels.position}</Th>
            <Th align="right">{labels.birthYear}</Th>
          </>
        }
      >
        {members.map((member) => (
          <tr
            key={member.id}
            className="transition-colors duration-[var(--motion-fast)] hover:bg-surface-sunken"
          >
            {showNumbers && (
              <Td align="right" numeric className="font-display font-bold text-muted">
                {member.shirt_number ?? "—"}
              </Td>
            )}
            <Td header sticky>
              <span className="inline-flex flex-wrap items-baseline gap-2">
                {member.full_name}
                {/* The club's head coach — normally the person who registered
                    the club — is called out alongside their translated staff
                    role. */}
                {member.is_head_coach && (
                  <span className="eyebrow rounded-[var(--radius-pill)] bg-accent-tint px-2 py-0.5 text-accent-on-tint">
                    {labels.headCoach}
                  </span>
                )}
              </span>
            </Td>
            <Td className="text-muted">
              {member.position
                ? labels.positionLabels[member.position as ClubMemberPosition] ?? member.position
                : "—"}
            </Td>
            <Td align="right" numeric className="text-muted">
              {member.birth_year ?? "—"}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export default async function ClubProfilePage({
  params,
}: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const [t, nav, myClub] = await Promise.all([
    getTranslations("clubs"),
    getTranslations("nav"),
    getTranslations("myClub"),
  ]);

  const club = await findClubBySlug(slug, true);
  if (!club) notFound();

  const [members, documents] = await Promise.all([
    listClubMembers(club.id),
    listPublicClubDocuments(club.id),
  ]);
  const { players, coaches, supportStaff } = groupClubMembers(members);
  const achievements = localizedClubAchievements(club, locale);
  const socials = clubSocialLinks(club);
  const rosterLabels = {
    number: t("number"),
    name: t("name"),
    position: t("position"),
    birthYear: t("birthYear"),
    headCoach: t("headCoach"),
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
  };

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={club.name} lead={club.province}>
        <Breadcrumbs
          label={nav("primary")}
          items={[
            { href: "/", label: nav("home") },
            { href: "/clubs", label: t("title") },
            { label: club.name },
          ]}
        />
      </PageHeader>

      <div className="border-b border-border bg-surface">
        <Container className="flex flex-wrap items-center gap-6 py-6">
          <ClubCrest name={club.name} logoUrl={club.logo_url} size={80} />
          <StatList
            items={[
              ...(club.founding_year
                ? [{ label: t("founded"), value: club.founding_year }]
                : []),
              { label: t("province"), value: club.province },
              { label: t("roster"), value: members.length },
            ]}
          />
        </Container>
      </div>

      <Container className="flex flex-col gap-12 py-10 sm:py-12">
        {/* REQ-CLUB-004 — achievements. Section always renders, with an empty
            state, so the profile consistently offers every REQ-CLUB-004/5/6
            section rather than silently omitting one. */}
        <section aria-labelledby="achievements">
          <SectionHeading id="achievements">{t("achievements")}</SectionHeading>
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

        {/* REQ-CLUB-005 — roster and coaching staff. */}
        <section aria-labelledby="roster">
          <SectionHeading id="roster">{t("roster")}</SectionHeading>
          {/* Players and coaching staff each keep their own empty state
              instead of one shared "no roster" message. A club that has
              published players but not yet its coaches is a normal state, and
              `RosterTable` renders nothing at all when its list is empty — so
              without these fallbacks the coaching section would silently
              vanish, which reads as a rendering bug rather than "not
              announced yet". */}
          <div className="flex flex-col gap-8">
            {players.length > 0 ? (
              <RosterTable
                members={players}
                heading={t("roster")}
                labels={rosterLabels}
              />
            ) : (
              <p className="text-[length:var(--text-sm)] text-muted">{t("noRoster")}</p>
            )}

            {coaches.length > 0 || supportStaff.length > 0 ? (
              <>
                <RosterTable
                  members={coaches}
                  heading={t("coachingStaff")}
                  labels={rosterLabels}
                />
                <RosterTable
                  members={supportStaff}
                  heading={t("staff")}
                  labels={rosterLabels}
                />
              </>
            ) : (
              <div>
                <h3 className="eyebrow mb-3 text-muted">{t("coachingStaff")}</h3>
                <p className="text-[length:var(--text-sm)] text-muted">
                  {t("noCoachingStaff")}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* REQ-CLUB-006 — contact info and social links. Always rendered,
            each half with its own empty state (task spec: "Liên hệ & Mạng
            xã hội" contains "Thông tin liên hệ" and "Liên kết mạng xã hội"). */}
        <section aria-labelledby="club-contact">
          <SectionHeading id="club-contact">{t("contactSocial")}</SectionHeading>

          {/* `min-w-0`: grid items default to `min-width:auto`, so a long
              unbreakable email address or URL below would stretch the column
              past the viewport and scroll the whole page sideways on a phone.
              The links themselves carry `break-all` for the same reason. */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="eyebrow mb-3 text-muted">{t("contactInfo")}</h3>
              {club.contact_email || club.contact_phone || club.website_url ? (
                <dl className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border/80 bg-surface p-6 shadow-[var(--shadow-xs)]">
                  {club.contact_email && (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <dt className="text-[length:var(--text-sm)] text-muted">Email:</dt>
                      <dd>
                        <a
                          href={`mailto:${club.contact_email}`}
                          className="break-all text-sm font-semibold hover:underline"
                        >
                          {club.contact_email}
                        </a>
                      </dd>
                    </div>
                  )}
                  {club.contact_phone && (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <dt className="text-[length:var(--text-sm)] text-muted">{t("phone")}:</dt>
                      <dd>
                        <a
                          href={`tel:${club.contact_phone.replace(/\s+/g, "")}`}
                          className="text-sm font-semibold hover:underline"
                        >
                          {club.contact_phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {club.website_url && (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <dt className="text-[length:var(--text-sm)] text-muted">{t("website")}:</dt>
                      <dd>
                        <a
                          href={club.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-sm font-semibold text-brand-text-text hover:underline"
                        >
                          {club.website_url}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-[length:var(--text-sm)] text-muted">{t("noContact")}</p>
              )}
            </div>

            <div>
              <h3 className="eyebrow mb-3 text-muted">{t("social")}</h3>
              {socials.length > 0 ? (
                <div className="flex flex-wrap gap-2.5 rounded-[var(--radius-lg)] border border-border/80 bg-surface p-6 shadow-[var(--shadow-xs)]">
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

        {/* REQ-REG-003 — documents follow their approved club's public state. */}
        <section aria-labelledby="club-documents">
          <SectionHeading id="club-documents">{t("documents")}</SectionHeading>
          {documents.length > 0 ? (
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-xs)]">
              {documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
                  <span className="text-sm font-semibold">{doc.filename}</span>
                  <a
                    href={`/api/clubs/${club.slug}/documents/${doc.id}`}
                    className="text-sm font-semibold text-brand-text-text hover:underline"
                  >
                    {t("viewDocument")}
                  </a>
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
