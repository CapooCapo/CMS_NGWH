import { requireOwner } from "@/server/auth/ownerGuard";
import { findClubByOwnerAndId, updateClub } from "@/server/repositories/clubs";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";
import { parseOwnerClub } from "@/server/validation/ownerClub";
import type { Club } from "@/server/repositories/types";

async function ownedClubForRequest(
  params: Promise<{ id: string }>
): Promise<
  | { ok: true; club: Club }
  | { ok: false; response: Response }
> {
  const guard = await requireOwner();
  if (!guard.ok) return { ok: false, response: guard.response };

  const id = parseId((await params).id);
  if (!id) return { ok: false, response: notFound() };
  const club = await findClubByOwnerAndId(guard.owner.id, id);
  // A missing club and another owner's club intentionally have the same 404.
  if (!club) return { ok: false, response: notFound() };
  return { ok: true, club };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await ownedClubForRequest(params);
    if (!result.ok) return result.response;
    return ok({ club: result.club });
  } catch (error) {
    return fail("get owner club", error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await ownedClubForRequest(params);
    if (!result.ok) return result.response;

    const edits = parseOwnerClub(await readJson(request));
    const club = await updateClub(result.club.id, {
      ...edits,
      slug: result.club.slug,
      isApproved: result.club.is_approved,
    });
    if (!club) return notFound();
    return ok({ club });
  } catch (error) {
    return fail("update owner club", error);
  }
}

/**
 * Club removal is intentionally unavailable. The data model defines cascades
 * for child rows but no product decision for registrations, public documents,
 * fixtures, or historical records; deleting a club here would invent that
 * policy. The confirmation is nevertheless server-validated so a future
 * approved deletion policy cannot accidentally rely on client-side checks.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await ownedClubForRequest(params);
    if (!result.ok) return result.response;

    const body = await readJson(request);
    if (body.confirmation !== "DELETE") {
      return Response.json(
        { error: "validation", fields: { confirmation: "mustConfirmDelete" } },
        { status: 400 }
      );
    }
    return Response.json({ error: "deletionNotAllowed" }, { status: 409 });
  } catch (error) {
    return fail("delete owner club", error);
  }
}
