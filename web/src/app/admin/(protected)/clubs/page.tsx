import Link from "next/link";
import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ClubMembersTable } from "@/components/admin/ClubMembersTable";
import { ClubOwnerPanel } from "@/components/admin/ClubOwnerPanel";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, Card, EmptyState, ErrorState } from "@/components/ui";
import { listClubMembers, listClubs } from "@/server/repositories/clubs";
import { findClubOwnerById } from "@/server/repositories/clubOwners";
import { SOCIAL_LINK_FIELDS } from "@/lib/clubSocialLinks";
import { PLAYER_POSITIONS, STAFF_ROLES } from "@/lib/clubMembers";

export const metadata: Metadata = {
  title: "Clubs",
  robots: { index: false, follow: false },
};

const MEMBER_POSITION_LABELS = {
  PG: "Point guard (PG)",
  SG: "Shooting guard (SG)",
  SF: "Small forward (SF)",
  PF: "Power forward (PF)",
  C: "Center (C)",
  HEAD_COACH: "Head coach",
  ASSISTANT_COACH: "Assistant coach",
  TEAM_MANAGER: "Team manager",
  TEAM_DOCTOR: "Team doctor",
  PHYSIOTHERAPIST: "Physiotherapist",
  STATISTICIAN: "Statistician",
  INTERPRETER: "Interpreter",
} as const;

// The selected member type determines which codes the API accepts. This
// combined control keeps the generic admin create form compact without
// bringing back a free-text position field.
const MEMBER_POSITION_OPTIONS = [
  ...PLAYER_POSITIONS,
  ...STAFF_ROLES.filter((role) => role !== "HEAD_COACH"),
].map((value) => ({ value, label: MEMBER_POSITION_LABELS[value] }));

/**
 * Club administration.
 *
 * Shows unapproved clubs too (unlike the public directory), and the publish
 * toggle is the direct BR-001 control for clubs that were created by staff
 * rather than through a registration.
 *
 * A Club Owner self-service dashboard (`/my-club`, REQ-REG-004/REQ-REG-005
 * shape) is implemented — explicit product decision overriding the earlier
 * OQ-012/OQ-013 BLOCKED status, see `.ai/IMPLEMENTATION_PROGRESS.md`. This
 * page is still where an admin creates and assigns the owner account for a
 * club ("Club Owner account" panel per row) and still works standalone for
 * clubs with no owner account — staff can always manage any club directly.
 */
export default async function AdminClubsPage({
  searchParams,
}: PageProps<"/admin/clubs">) {
  const params = await searchParams;
  const rawHighlight = Array.isArray(params.highlight) ? params.highlight[0] : params.highlight;
  const highlightId = rawHighlight ? Number(rawHighlight) : null;

  let clubs;
  try {
    clubs = await listClubs({ approvedOnly: false, limit: 100 });
  } catch (error) {
    console.error("admin clubs", error);
    return (
      <>
        <AdminPageHeader title="Clubs" />
        <ErrorState title="Database unavailable" />
      </>
    );
  }

  const membersByClub = await Promise.all(
    clubs.rows.map((club) => listClubMembers(club.id).catch(() => []))
  );
  const ownersByClub = await Promise.all(
    clubs.rows.map((club) =>
      club.owner_id ? findClubOwnerById(club.owner_id).catch(() => null) : null
    )
  );

  return (
    <>
      <AdminPageHeader
        title="Clubs"
        description="A club profile is public only while it is published (BR-001)."
      />

      <div className="mb-6">
        <Disclosure label="Add a club">
          <JsonForm
            action="/api/admin/clubs"
            submitLabel="Create club"
            fields={[
              { name: "name", label: "Club name", required: true },
              {
                name: "slug",
                label: "URL slug",
                required: true,
                hint: "Lowercase letters, numbers and hyphens.",
              },
              { name: "province", label: "Province / region", required: true },
              { name: "foundingYear", label: "Founding year", type: "number", min: 1800, max: 2200 },
              { name: "logoUrl", label: "Logo URL", type: "url" },
              { name: "websiteUrl", label: "Website", type: "url" },
              { name: "contactEmail", label: "Contact email", type: "email" },
              { name: "contactPhone", label: "Contact phone", type: "tel" },
              { name: "achievementsEn", label: "Achievements (EN)", type: "textarea", colSpan: 2 },
              { name: "achievementsVi", label: "Achievements (VI)", type: "textarea", colSpan: 2 },
              { name: "socialLinks", label: "Social links", type: "urlgroup", keys: SOCIAL_LINK_FIELDS, colSpan: 2 },
              { name: "isApproved", label: "Publish immediately", type: "checkbox", colSpan: 2 },
            ]}
          />
        </Disclosure>
      </div>

      {clubs.rows.length === 0 ? (
        <EmptyState title="No clubs yet." />
      ) : (
        <ul className="flex flex-col gap-3">
          {clubs.rows.map((club, i) => (
            <li
              key={club.id}
              id={`club-${club.id}`}
              className={
                highlightId === club.id
                  ? "rounded-[var(--radius-lg)] ring-2 ring-accent ring-offset-2 ring-offset-background"
                  : undefined
              }
            >
              <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{club.name}</h2>
                    <Badge tone={club.is_approved ? "success" : "warning"}>
                      {club.is_approved ? "Published" : "Unpublished"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[length:var(--text-sm)] text-muted">
                    {club.province} · /clubs/{club.slug}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {club.is_approved && (
                    <Link
                      href={`/clubs/${club.slug}`}
                      className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline"
                    >
                      View
                    </Link>
                  )}
                  <ToggleButton
                    action={`/api/admin/clubs/${club.id}/approval`}
                    body={{ isApproved: !club.is_approved }}
                    label={club.is_approved ? "Unpublish" : "Publish"}
                    tone={club.is_approved ? "outline" : "primary"}
                    confirm={
                      club.is_approved
                        ? "Unpublish this club? Its public profile will 404."
                        : undefined
                    }
                  />
                </div>
              </Card>

              <div className="mt-2 flex flex-col gap-2">
                <Disclosure label={`Edit club — ${club.name}`}>
                  <JsonForm
                    action={`/api/admin/clubs/${club.id}`}
                    method="PATCH"
                    submitLabel="Save changes"
                    fields={[
                      { name: "name", label: "Club name", required: true, defaultValue: club.name },
                      { name: "slug", label: "URL slug", required: true, defaultValue: club.slug },
                      { name: "province", label: "Province / region", required: true, defaultValue: club.province },
                      {
                        name: "foundingYear",
                        label: "Founding year",
                        type: "number",
                        min: 1800,
                        max: 2200,
                        defaultValue: club.founding_year,
                      },
                      { name: "logoUrl", label: "Logo URL", type: "url", defaultValue: club.logo_url },
                      { name: "websiteUrl", label: "Website", type: "url", defaultValue: club.website_url },
                      { name: "contactEmail", label: "Contact email", type: "email", defaultValue: club.contact_email },
                      { name: "contactPhone", label: "Contact phone", type: "tel", defaultValue: club.contact_phone },
                      {
                        name: "achievementsEn",
                        label: "Achievements (EN)",
                        type: "textarea",
                        colSpan: 2,
                        defaultValue: club.achievements_en,
                      },
                      {
                        name: "achievementsVi",
                        label: "Achievements (VI)",
                        type: "textarea",
                        colSpan: 2,
                        defaultValue: club.achievements_vi,
                      },
                      {
                        name: "socialLinks",
                        label: "Social links",
                        type: "urlgroup",
                        keys: SOCIAL_LINK_FIELDS,
                        colSpan: 2,
                        defaultValue: club.social_links,
                      },
                      {
                        name: "isApproved",
                        label: "Published",
                        type: "checkbox",
                        colSpan: 2,
                        defaultChecked: club.is_approved,
                      },
                    ]}
                  />
                </Disclosure>

                <Disclosure
                  label={
                    ownersByClub[i]
                      ? `Club Owner account — ${club.name} (${ownersByClub[i]!.email})`
                      : `Club Owner account — ${club.name} (none)`
                  }
                >
                  <ClubOwnerPanel clubId={club.id} owner={ownersByClub[i]} />
                </Disclosure>

                <Disclosure label={`Roster & coaching staff — ${club.name} (${membersByClub[i].length})`}>
                  <div className="flex flex-col gap-4">
                    <ClubMembersTable
                      actionBase={`/api/admin/clubs/${club.id}/members`}
                      members={membersByClub[i]}
                      emptyLabel="No roster or coaching staff has been added yet."
                    />
                    <div className="border-t border-border pt-4">
                      <h3 className="eyebrow mb-3 text-muted">Add a member</h3>
                      <JsonForm
                        action={`/api/admin/clubs/${club.id}/members`}
                        submitLabel="Add member"
                        compact
                        fields={[
                          { name: "fullName", label: "Full name", required: true },
                          {
                            name: "memberRole",
                            label: "Role",
                            type: "select",
                            required: true,
                            defaultValue: "player",
                            options: [
                              { value: "player", label: "Player" },
                              { value: "coach", label: "Coach" },
                              { value: "staff", label: "Staff" },
                            ],
                          },
                          { name: "shirtNumber", label: "No.", type: "number", min: 0, max: 99 },
                          {
                            name: "position",
                            label: "Position / staff role",
                            type: "select",
                            options: MEMBER_POSITION_OPTIONS,
                          },
                          { name: "birthYear", label: "Born", type: "number", min: 1900, max: 2200 },
                        ]}
                      />
                    </div>
                  </div>
                </Disclosure>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
