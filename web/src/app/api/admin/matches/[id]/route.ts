import { requireRole, requireViewer } from "@/server/auth/guard";
import {
  deleteMatch,
  findMatchById,
} from "@/server/repositories/matches";
import { updateLiveMatch } from "@/server/services/liveMatchUpdates";
import { parseMatch } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireViewer("editor", "operator");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const match = await findMatchById(id);
    if (!match) return notFound();
    return ok({ match });
  } catch (error) {
    return fail("get match", error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("editor");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const input = parseMatch(await readJson(request));
    const match = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "match.update", resourceType: "match", resourceId: id, metadata: { changed: Object.keys(input) } },
      () => updateLiveMatch(id, input),
      Boolean
    );
    if (!match) return notFound();
    return ok({ match });
  } catch (error) {
    return fail("update match", error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Destructive, so `admin` only — an editor can edit but not delete a fixture.
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const deleted = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "match.delete", resourceType: "match", resourceId: id },
      () => deleteMatch(id),
      Boolean
    );
    if (!deleted) return notFound();
    return ok({ ok: true });
  } catch (error) {
    return fail("delete match", error);
  }
}
