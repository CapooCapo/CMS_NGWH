import { requireRole } from "@/server/auth/guard";
import {
  deleteClubMember,
  findClubMember,
  updateClubMember,
} from "@/server/repositories/clubs";
import { parseClubMember } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

/** REQ-CLUB-005 — edit an existing roster/coaching-staff entry. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const guard = await requireRole("editor");
  if (!guard.ok) return guard.response;
  const { id: rawId, memberId: rawMember } = await params;
  const id = parseId(rawId);
  const memberId = parseId(rawMember);
  if (!id || !memberId) return notFound();
  try {
    const existing = await findClubMember(id, memberId);
    if (!existing) return notFound();
    // Scoped by club id so a member cannot be edited through another club.
    const input = parseClubMember(await readJson(request), {
      allowHeadCoach: existing.is_head_coach,
    });
    const member = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "club.member.update", resourceType: "club_member", resourceId: memberId, metadata: { clubId: id, changed: Object.keys(input) } },
      () => updateClubMember(id, memberId, input),
      Boolean
    );
    if (!member) return notFound();
    return ok({ member });
  } catch (error) {
    return fail("update club member", error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const guard = await requireRole("editor");
  if (!guard.ok) return guard.response;
  const { id: rawId, memberId: rawMember } = await params;
  const id = parseId(rawId);
  const memberId = parseId(rawMember);
  if (!id || !memberId) return notFound();
  try {
    // Scoped by club id so a member cannot be deleted through another club.
    const removed = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "club.member.delete", resourceType: "club_member", resourceId: memberId, metadata: { clubId: id } },
      () => deleteClubMember(id, memberId),
      (result) => result.ok
    );
    if (!removed.ok) {
      // Same invariant as the owner route: the head-coach row is the club
      // owner's identity on the club. Staff remove it by unassigning the
      // owner (DELETE .../owner), which clears both together.
      if (removed.reason === "headCoach") {
        return Response.json({ error: "headCoachProtected" }, { status: 409 });
      }
      return notFound();
    }
    return ok({ ok: true });
  } catch (error) {
    return fail("delete club member", error);
  }
}
