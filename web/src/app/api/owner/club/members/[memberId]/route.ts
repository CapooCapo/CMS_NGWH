import { requireOwnedClub } from "@/server/auth/ownerGuard";
import {
  deleteClubMember,
  findClubMember,
  updateClubMember,
} from "@/server/repositories/clubs";
import { parseClubMember } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

/**
 * Edit/delete one roster/coaching-staff entry, scoped to the authenticated
 * owner's own club — `updateClubMember`/`deleteClubMember` both filter by
 * `club_id` in the same query, so a memberId belonging to a different club
 * (Owner B's roster) resolves to 404 here, never a cross-club edit.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const guard = await requireOwnedClub();
  if (!guard.ok) return guard.response;

  const memberId = parseId((await params).memberId);
  if (!memberId) return notFound();

  try {
    const existing = await findClubMember(guard.club.id, memberId);
    if (!existing) return notFound();
    const member = await updateClubMember(
      guard.club.id,
      memberId,
      parseClubMember(await readJson(request), {
        allowHeadCoach: existing.is_head_coach,
      })
    );
    if (!member) return notFound();
    return ok({ member });
  } catch (error) {
    return fail("owner update club member", error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const guard = await requireOwnedClub();
  if (!guard.ok) return guard.response;

  const memberId = parseId((await params).memberId);
  if (!memberId) return notFound();

  try {
    const removed = await deleteClubMember(guard.club.id, memberId);
    if (!removed.ok) {
      // The head-coach row is the owner's own identity on the club and
      // cannot be removed; 409 (not 404) because it genuinely exists.
      if (removed.reason === "headCoach") {
        return Response.json({ error: "headCoachProtected" }, { status: 409 });
      }
      return notFound();
    }
    return ok({ ok: true });
  } catch (error) {
    return fail("owner delete club member", error);
  }
}
