import { requireOwnedClub } from "@/server/auth/ownerGuard";
import { createClubMember } from "@/server/repositories/clubs";
import { parseClubMember } from "@/server/validation/admin";
import { fail, ok } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

/**
 * Roster/coaching-staff create, scoped to the authenticated owner's own club.
 * Validation is the same `parseClubMember` the admin route uses (field rules
 * don't depend on who is calling); authorization is what differs, and that is
 * entirely `requireOwnedClub()`.
 */
export async function POST(request: Request) {
  const guard = await requireOwnedClub();
  if (!guard.ok) return guard.response;
  try {
    const member = await createClubMember(
      guard.club.id,
      parseClubMember(await readJson(request))
    );
    return ok({ member }, 201);
  } catch (error) {
    return fail("owner create club member", error);
  }
}
