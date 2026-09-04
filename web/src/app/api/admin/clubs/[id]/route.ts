import { requireRole, requireViewer } from "@/server/auth/guard";
import { findClubById, updateClub } from "@/server/repositories/clubs";
import { listClubMembers } from "@/server/repositories/clubs";
import { parseClub } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

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
    const club = await updateClub(id, parseClub(await readJson(request)));
    if (!club) return notFound();
    return ok({ club });
  } catch (error) {
    return fail("update club", error);
  }
}
