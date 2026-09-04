import { requireOwner } from "@/server/auth/ownerGuard";
import { findClubByOwnerId } from "@/server/repositories/clubs";
import { listRegistrationsForOwner } from "@/server/repositories/registrations";
import { fail, ok } from "@/server/api/respond";

/**
 * The authenticated account's club workspace. Both queries receive the owner
 * id resolved from the session; callers cannot filter this endpoint by an id
 * supplied in the URL or request body.
 */
export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return guard.response;

  try {
    const [club, registrations] = await Promise.all([
      findClubByOwnerId(guard.owner.id),
      listRegistrationsForOwner(guard.owner.id),
    ]);
    return ok({ clubs: club ? [club] : [], registrations });
  } catch (error) {
    return fail("list owner clubs", error);
  }
}
