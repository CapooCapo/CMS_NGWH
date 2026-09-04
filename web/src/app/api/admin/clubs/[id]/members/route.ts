import { requireRole, requireViewer } from "@/server/auth/guard";
import {
  createClubMember,
  findClubById,
  listClubMembers,
} from "@/server/repositories/clubs";
import { parseClubMember } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

/** REQ-CLUB-005 — roster and coaching staff maintenance. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireViewer("editor");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return ok({ members: await listClubMembers(id) });
  } catch (error) {
    return fail("list club members", error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("editor");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    // Confirm the club exists first so the response is 404 rather than a
    // foreign-key 409.
    if (!(await findClubById(id))) return notFound();
    const member = await createClubMember(id, parseClubMember(await readJson(request)));
    return ok({ member }, 201);
  } catch (error) {
    return fail("create club member", error);
  }
}
