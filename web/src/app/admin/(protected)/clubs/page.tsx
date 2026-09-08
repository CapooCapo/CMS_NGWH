import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  ClubMembersTable,
  type ClubMembersLabels,
} from "@/components/admin/ClubMembersTable";
import { ClubOwnerPanel } from "@/components/admin/ClubOwnerPanel";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { ToggleButton } from "@/components/admin/ToggleButton";
import { Badge, EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { parsePage } from "@/lib/pagination";
import { listAdminClubs, listClubMembers } from "@/server/repositories/clubs";
import { findClubOwnerById } from "@/server/repositories/clubOwners";
import { SOCIAL_LINK_FIELDS } from "@/lib/clubSocialLinks";
import { PLAYER_POSITIONS, STAFF_ROLES } from "@/lib/clubMembers";
import type { PageSearchParams } from "@/app/page-props";

type PageProps = {
  searchParams: PageSearchParams;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.clubs");
  return {
    title: t("metaTitle"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

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
}: PageProps) {
  const t = await getTranslations("admin.clubs");
  const memberPositionLabels = {
    PG: t("members.positionPG"),
    SG: t("members.positionSG"),
    SF: t("members.positionSF"),
    PF: t("members.positionPF"),
    C: t("members.positionC"),
    HEAD_COACH: t("members.staffRoleHeadCoach"),
    ASSISTANT_COACH: t("members.staffRoleAssistantCoach"),
    TEAM_MANAGER: t("members.staffRoleTeamManager"),
    TEAM_DOCTOR: t("members.staffRoleTeamDoctor"),
    PHYSIOTHERAPIST: t("members.staffRolePhysiotherapist"),
    STATISTICIAN: t("members.staffRoleStatistician"),
    INTERPRETER: t("members.staffRoleInterpreter"),
  } as const;
  // The selected member type determines which codes the API accepts. This
  // combined control keeps the generic admin create form compact without
  // bringing back a free-text position field.
  const memberPositionOptions = [
    ...PLAYER_POSITIONS,
    ...STAFF_ROLES.filter((role) => role !== "HEAD_COACH"),
  ].map((value) => ({ value, label: memberPositionLabels[value] }));
  const memberLabels: ClubMembersLabels = {
    caption: t("members.caption"),
    number: t("members.number"),
    name: t("members.name"),
    role: t("members.role"),
    position: t("members.position"),
    born: t("members.born"),
    actions: t("members.actions"),
    edit: t("members.edit"),
    cancel: t("members.cancel"),
    delete: t("members.delete"),
    deleteConfirmTemplate: t("members.deleteConfirm", { name: "{name}" }),
    saveChanges: t("members.saveChanges"),
    fullName: t("members.fullName"),
    roleLabels: {
      player: t("members.player"),
      coach: t("members.coach"),
      staff: t("members.staff"),
    },
    positionLabels: memberPositionLabels,
    headCoach: t("members.headCoach"),
  };
  const params = await searchParams;
  const rawHighlight = Array.isArray(params.highlight) ? params.highlight[0] : params.highlight;
  const highlightId = rawHighlight ? Number(rawHighlight) : null;
  const page = parsePage(params.page);
  const rawPanel = Array.isArray(params.panel) ? params.panel[0] : params.panel;
  const selectedPanel = rawPanel === "edit" || rawPanel === "owner" || rawPanel === "roster" ? rawPanel : null;
  const rawClub = Array.isArray(params.club) ? params.club[0] : params.club;
  const selectedClubId = rawClub ? Number.parseInt(rawClub, 10) : null;

  let clubs;
  try {
    clubs = await listAdminClubs(page, highlightId);
  } catch (error) {
    console.error("admin clubs", error);
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState title={t("databaseUnavailable")} />
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

  const hrefForPanel = (clubId: number, panel: typeof selectedPanel) => {
    const query = new URLSearchParams();
    if (clubs.page > 1) query.set("page", String(clubs.page));
    if (selectedClubId !== clubId || selectedPanel !== panel) {
      query.set("club", String(clubId));
      if (panel) query.set("panel", panel);
    }
    const suffix = query.toString();
    return `/admin/clubs${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
      />

      <div className="mb-6">
        <Disclosure label={t("add")}>
          <JsonForm
            action="/api/admin/clubs"
            submitLabel={t("create")}
            fields={[
              { name: "name", label: t("name"), required: true },
              {
                name: "slug",
                label: t("slug"),
                required: true,
                hint: t("slugHint"),
              },
              { name: "province", label: t("province"), required: true },
              { name: "foundingYear", label: t("foundingYear"), type: "number", min: 1800, max: 2200 },
              { name: "logoUrl", label: t("logoUrl"), type: "url" },
              { name: "websiteUrl", label: t("website"), type: "url" },
              { name: "contactEmail", label: t("contactEmail"), type: "email" },
              { name: "contactPhone", label: t("contactPhone"), type: "tel" },
              {
                type: "localizedSingle",
                label: t("achievements"),
                enName: "achievementsEn",
                viName: "achievementsVi",
                hint: t("achievementsHint"),
                sourceLanguageLabel: t("achievementSourceLanguage"),
                englishLabel: t("achievementEnglish"),
                vietnameseLabel: t("achievementVietnamese"),
                rows: 4,
                colSpan: 2,
              },
              { name: "socialLinks", label: t("socialLinks"), type: "urlgroup", keys: SOCIAL_LINK_FIELDS, colSpan: 2 },
              { name: "isApproved", label: t("publishImmediately"), type: "checkbox", colSpan: 2 },
            ]}
          />
        </Disclosure>
      </div>

      {clubs.rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <>
          <Table
            caption={t("tableCaption")}
            minWidth="60rem"
            head={<><Th sticky>{t("name")}</Th><Th>{t("province")}</Th><Th>{t("contact")}</Th><Th>{t("status")}</Th><Th align="right">{t("actions")}</Th></>}
          >
            {clubs.rows.map((club, index) => {
              const selected = selectedClubId === club.id && selectedPanel;
              const highlighted = highlightId === club.id;
              return (
                <Fragment key={club.id}>
                  <tr id={`club-${club.id}`} className={highlighted || selected ? "bg-accent/10" : "hover:bg-surface-sunken"}>
                    <Td header sticky><span className="block">{club.name}</span><span className="block text-[length:var(--text-xs)] font-normal text-muted">/clubs/{club.slug}</span></Td>
                    <Td>{club.province}</Td>
                    <Td><span className="block">{club.contact_email ?? "—"}</span><span className="block text-[length:var(--text-xs)] text-muted">{club.contact_phone ?? club.website_url ?? ""}</span></Td>
                    <Td><Badge tone={club.is_approved ? "success" : "warning"}>{club.is_approved ? t("published") : t("unpublished")}</Badge></Td>
                    <Td align="right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {club.is_approved && <Link href={`/clubs/${club.slug}`} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{t("view")}</Link>}
                        {club.deletion_requested_at && <ToggleButton action={`/api/admin/clubs/${club.id}`} method="DELETE" label={t("approveDeletion")} tone="danger" confirm={t("approveDeletionConfirm", { club: club.name })} />}
                        <ToggleButton action={`/api/admin/clubs/${club.id}/approval`} body={{ isApproved: !club.is_approved }} label={club.is_approved ? t("unpublish") : t("publish")} tone={club.is_approved ? "outline" : "primary"} confirm={club.is_approved ? t("unpublishConfirm") : undefined} />
                        <Link href={hrefForPanel(club.id, "edit")} aria-expanded={selectedPanel === "edit" && selectedClubId === club.id} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{t("editAction")}</Link>
                        <Link href={hrefForPanel(club.id, "owner")} aria-expanded={selectedPanel === "owner" && selectedClubId === club.id} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{t("ownerAction")}</Link>
                        <Link href={hrefForPanel(club.id, "roster")} aria-expanded={selectedPanel === "roster" && selectedClubId === club.id} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{t("rosterAction")}</Link>
                      </div>
                    </Td>
                  </tr>
                  {selected && (
                    <tr className="bg-surface-sunken/45"><Td colSpan={5}>
                      {selectedPanel === "edit" && <JsonForm action={`/api/admin/clubs/${club.id}`} method="PATCH" submitLabel={t("saveChanges")} fields={[
                        { name: "name", label: t("name"), required: true, defaultValue: club.name }, { name: "slug", label: t("slug"), required: true, defaultValue: club.slug }, { name: "province", label: t("province"), required: true, defaultValue: club.province },
                        { name: "foundingYear", label: t("foundingYear"), type: "number", min: 1800, max: 2200, defaultValue: club.founding_year }, { name: "logoUrl", label: t("logoUrl"), type: "url", defaultValue: club.logo_url }, { name: "websiteUrl", label: t("website"), type: "url", defaultValue: club.website_url }, { name: "contactEmail", label: t("contactEmail"), type: "email", defaultValue: club.contact_email }, { name: "contactPhone", label: t("contactPhone"), type: "tel", defaultValue: club.contact_phone },
                        { type: "localizedSingle", label: t("achievements"), enName: "achievementsEn", viName: "achievementsVi", defaultEn: club.achievements_en, defaultVi: club.achievements_vi, hint: t("achievementsHint"), sourceLanguageLabel: t("achievementSourceLanguage"), englishLabel: t("achievementEnglish"), vietnameseLabel: t("achievementVietnamese"), rows: 4, colSpan: 2 },
                        { name: "socialLinks", label: t("socialLinks"), type: "urlgroup", keys: SOCIAL_LINK_FIELDS, colSpan: 2, defaultValue: club.social_links }, { name: "isApproved", label: t("publishedField"), type: "checkbox", colSpan: 2, defaultChecked: club.is_approved },
                      ]} />}
                      {selectedPanel === "owner" && <ClubOwnerPanel clubId={club.id} owner={ownersByClub[index]} />}
                      {selectedPanel === "roster" && <div className="flex flex-col gap-4"><ClubMembersTable actionBase={`/api/admin/clubs/${club.id}/members`} members={membersByClub[index]} emptyLabel={t("members.empty")} labels={memberLabels} /><div className="border-t border-border pt-4"><h3 className="eyebrow mb-3 text-muted">{t("members.add")}</h3><JsonForm action={`/api/admin/clubs/${club.id}/members`} submitLabel={t("members.add")} compact fields={[{ name: "fullName", label: t("members.fullName"), required: true }, { name: "memberRole", label: t("members.role"), type: "select", required: true, defaultValue: "player", options: [{ value: "player", label: t("members.player") }, { value: "coach", label: t("members.coach") }, { value: "staff", label: t("members.staff") }] }, { name: "shirtNumber", label: t("members.number"), type: "number", min: 0, max: 99 }, { name: "position", label: t("members.positionOrStaffRole"), type: "select", options: memberPositionOptions }, { name: "birthYear", label: t("members.born"), type: "number", min: 1900, max: 2200 }]} /></div></div>}
                    </Td></tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
          <AdminPagination basePath="/admin/clubs" pagination={clubs} searchParams={{}} />
        </>
      )}
    </>
  );
}
