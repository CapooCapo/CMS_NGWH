import { requireRole } from "@/server/auth/guard";
import { setClubApproval } from "@/server/repositories/clubs";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { Validator, readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

/**
 * BR-001 — publish or unpublish a club profile directly.
 *
 * Separate from the registration review flow so a club created by staff (with
 * no submission behind it) can still be published, and so a mistake can be
 * reversed without touching the registration record.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const body = await readJson(request);
    const v = new Validator(body);
    v.only(["isApproved"]);
    v.assert();
    const club = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "club.approval.update", resourceType: "club", resourceId: id, metadata: { isApproved: body.isApproved === true } },
      () => setClubApproval(id, body.isApproved === true),
      Boolean
    );
    if (!club) return notFound();
    return ok({ club });
  } catch (error) {
    return fail("set club approval", error);
  }
}
