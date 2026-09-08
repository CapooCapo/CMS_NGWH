import { requireRole, requireViewer } from "@/server/auth/guard";
import { deleteRequestedClub, findClubById, updateClub } from "@/server/repositories/clubs";
import { listClubMembers } from "@/server/repositories/clubs";
import { parseClub } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireViewer("editor");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const club = await findClubById(id);
    if (!club) return notFound();
    return ok({ club, members: await listClubMembers(id) });
  } catch (error) {
    return fail("get club", error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const input = parseClub(await readJson(request));
    const club = await auditedAdminMutation(
      request,
      {
        actorId: guard.admin.id, action: "club.update", resourceType: "club", resourceId: id,
        metadata: { changed: Object.keys(input) },
      },
      () => updateClub(id, input),
      Boolean
    );
    if (!club) return notFound();
    return ok({ club });
  } catch (error) {
    return fail("update club", error);
  }
}

/** Finalizes an owner's pending deletion request. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const deleted = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "club.delete", resourceType: "club", resourceId: id },
      () => deleteRequestedClub(id),
      Boolean
    );
    if (!deleted) return notFound();
    return ok({ deleted: true });
  } catch (error) {
    return fail("delete requested club", error);
  }
}
