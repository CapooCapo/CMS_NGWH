import { Badge, ButtonLink, PageHeader } from "@/components/ui";
import { ClubCrest } from "@/components/clubs/ClubCrest";
import { ClubDeletionControl } from "./ClubDeletionControl";
import { ownerDisplayName } from "@/server/services/ownerWorkspace";
import type { MyClubApprovedPageData } from "@/server/services/myClub";

export function MyClubSummary({ data, labels }: { data: MyClubApprovedPageData; labels: Record<string, string> }) {
  const { club, owner, headCoach } = data;
  return <><PageHeader eyebrow={labels.eyebrow} title={club.name} lead={club.province} actions={club.is_approved ? <><ButtonLink href={`/clubs/${club.slug}`} tone="outline">{labels.viewPublicPage}</ButtonLink><ClubDeletionControl clubId={club.id} requested={Boolean(club.deletion_requested_at)} labels={{ open: labels.deleteClub, title: labels.deleteClub, body: labels.deleteClubBody, confirmationPrompt: labels.deleteClubConfirmation, cancel: labels.deleteClubCancel, confirm: labels.deleteClubConfirm, unavailable: labels.deleteClubUnavailable, failed: labels.deleteClubFailed, requested: labels.deleteClubRequested, cancelRequest: labels.cancelDeleteClubRequest }} /></> : undefined} />
    <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-[var(--shadow-xs)] sm:p-8"><div className="flex flex-wrap items-center justify-between gap-6"><div className="flex items-center gap-5"><ClubCrest name={club.name} logoUrl={club.logo_url} size={68} /><div><div className="flex flex-wrap items-center gap-2.5"><h2 className="font-display text-[length:var(--text-xl)] font-bold sm:text-[length:var(--text-2xl)]">{club.name}</h2><Badge tone={club.is_approved ? "success" : "warning"}>{club.is_approved ? "Published" : "Pending publication"}</Badge></div><p className="mt-1 text-[length:var(--text-sm)] text-muted">{club.province} {club.founding_year ? `· ${labels.founded} ${club.founding_year}` : ""}</p></div></div>{club.is_approved && <ButtonLink href={`/clubs/${club.slug}`} tone="outline" size="sm">{labels.viewPublicPage}</ButtonLink>}</div>
      <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2"><div><dt className="eyebrow text-muted">{labels.roleOwner}</dt><dd className="mt-1 text-[length:var(--text-sm)] font-semibold">{ownerDisplayName(owner)}</dd></div>{headCoach && <div><dt className="eyebrow text-muted">{labels.roleHeadCoach}</dt><dd className="mt-1 text-[length:var(--text-sm)] font-semibold">{headCoach.full_name}</dd></div>}</dl>
    </div></>;
}
