import { requireOwner } from "@/server/auth/ownerGuard";
import { updateClubOwnerProfile } from "@/server/repositories/clubOwners";
import { fail, notFound, ok } from "@/server/api/respond";
import { readJson, Validator } from "@/server/validation/validate";

/** The current account profile. Its identity is always session-derived. */
export async function PATCH(request: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return guard.response;

  try {
    const v = new Validator(await readJson(request));
    const fullName = v.string("fullName", { required: true, min: 2, max: 160 }) ?? "";
    v.assert();

    const owner = await updateClubOwnerProfile(guard.owner.id, { fullName });
    if (!owner) return notFound();
    return ok({ owner });
  } catch (error) {
    return fail("update owner profile", error);
  }
}
