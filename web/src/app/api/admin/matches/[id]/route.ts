import { requireRole, requireViewer } from "@/server/auth/guard";
import {
  deleteMatch,
  findMatchById,
} from "@/server/repositories/matches";
import { updateLiveMatch } from "@/server/services/liveMatchUpdates";
import { parseMatch } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

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
    const match = await updateLiveMatch(id, parseMatch(await readJson(request)));
    if (!match) return notFound();
    return ok({ match });
  } catch (error) {
    return fail("update match", error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Destructive, so `admin` only — an editor can edit but not delete a fixture.
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    if (!(await deleteMatch(id))) return notFound();
    return ok({ ok: true });
  } catch (error) {
    return fail("delete match", error);
  }
}
