import "server-only";
import { listClubMembers } from "@/server/repositories/clubs";
import { listRegistrationDocumentsForClub } from "@/server/repositories/registrations";
import { resolveOwnerWorkspace } from "./ownerWorkspace";

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
