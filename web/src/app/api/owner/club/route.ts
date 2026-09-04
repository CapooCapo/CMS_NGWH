import { requireOwnedClub } from "@/server/auth/ownerGuard";
import { listClubMembers, updateClub } from "@/server/repositories/clubs";
import { listRegistrationDocumentsForClub } from "@/server/repositories/registrations";
import { parseOwnerClub } from "@/server/validation/ownerClub";
import { fail, ok } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

/**
 * "My Club" — the authenticated owner's own club, never anything picked by a
 * client-supplied id. `requireOwnedClub()` is the entire authorization
 * decision: it resolves "which club does this session own" from
 * `clubs.owner_id`, so there is no clubId to tamper with in the first place.
 */
export async function GET() {
  const guard = await requireOwnedClub();
  if (!guard.ok) return guard.response;
  try {
    const [members, documents] = await Promise.all([
      listClubMembers(guard.club.id),
      listRegistrationDocumentsForClub(guard.club.id),
    ]);
    return ok({ club: guard.club, members, documents });
  } catch (error) {
    return fail("load owner club", error);
  }
}

/**
 * Edits the owner's own club profile. `slug` and `isApproved` are carried
 * over unchanged from the existing row — `parseOwnerClub` doesn't even accept
 * them, so an owner cannot self-publish/unpublish or change the club's URL.
 */
export async function PATCH(request: Request) {
  const guard = await requireOwnedClub();
  if (!guard.ok) return guard.response;
  try {
    const edits = parseOwnerClub(await readJson(request));
    const club = await updateClub(guard.club.id, {
      ...edits,
      slug: guard.club.slug,
      isApproved: guard.club.is_approved,
    });
    return ok({ club });
  } catch (error) {
    return fail("update owner club", error);
  }
}
