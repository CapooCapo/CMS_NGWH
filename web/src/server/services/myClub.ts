import "server-only";
import { listClubMembers } from "@/server/repositories/clubs";
import { listRegistrationDocumentsForClub } from "@/server/repositories/registrations";
import { resolveOwnerWorkspace } from "./ownerWorkspace";
import type { OwnerWorkspace } from "./ownerWorkspace";
import type { ClubMember } from "@/server/repositories/types";
import { clubSocialLinks, groupClubMembers, localizedClubAchievements } from "@/lib/clubView";

export type MyClubApprovedPageData = {
  state: "approved";
  owner: Extract<OwnerWorkspace, { state: "approved" }>["owner"];
  club: Extract<OwnerWorkspace, { state: "approved" }>["club"];
  members: readonly ClubMember[];
  documents: readonly Awaited<ReturnType<typeof listRegistrationDocumentsForClub>>[number][];
  players: readonly ClubMember[];
  coachStaff: readonly ClubMember[];
  headCoach: ClubMember | null;
  achievements: string | null;
  socials: [string, string][];
};

export type MyClubPageData =
  | Exclude<OwnerWorkspace, { state: "approved" }>
  | MyClubApprovedPageData;

export function buildMyClubApprovedPageData(
  workspace: Extract<OwnerWorkspace, { state: "approved" }>,
  members: readonly ClubMember[],
  documents: MyClubApprovedPageData["documents"],
  locale: string
): MyClubApprovedPageData {
  const { owner, club } = workspace;
  const groups = groupClubMembers(members);
  return {
    state: "approved",
    owner,
    club,
    members,
    documents,
    players: groups.players,
    coachStaff: groups.coachStaff,
    headCoach: groups.headCoach,
    achievements: localizedClubAchievements(club, locale),
    socials: clubSocialLinks(club),
  };
}

/** Loads the complete owner dashboard model without accepting client identity. */
export async function loadMyClubWorkspace() {
  const workspace = await resolveOwnerWorkspace();
  if (workspace.state !== "approved") return { workspace, members: [], documents: [] } as const;
  const [members, documents] = await Promise.all([
    listClubMembers(workspace.club.id),
    listRegistrationDocumentsForClub(workspace.club.id),
  ]);
  return { workspace, members, documents } as const;
}

/** Server-only data and presentation model for the owner dashboard. */
export async function loadMyClubPageData(locale: string): Promise<MyClubPageData> {
  const workspace = await loadMyClubWorkspace();
  if (workspace.workspace.state !== "approved") return workspace.workspace;
  return buildMyClubApprovedPageData(
    workspace.workspace,
    workspace.members,
    workspace.documents,
    locale
  );
}
