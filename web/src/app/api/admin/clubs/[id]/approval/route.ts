import { requireRole } from "@/server/auth/guard";
import { setClubApproval } from "@/server/repositories/clubs";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { Validator, readJson } from "@/server/validation/validate";

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
    v.assert();
    const club = await setClubApproval(id, body.isApproved === true);
    if (!club) return notFound();
    return ok({ club });
  } catch (error) {
    return fail("set club approval", error);
  }
}
