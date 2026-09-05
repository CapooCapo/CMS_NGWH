import { requireOwner } from "@/server/auth/ownerGuard";
import { cancelClubDeletionRequest } from "@/server/repositories/clubs";
import { fail, notFound, ok, parseId } from "@/server/api/respond";

/** Cancels the authenticated owner's still-pending club deletion request. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const request = await cancelClubDeletionRequest(id, guard.owner.id);
    if (!request) return notFound();
    return ok({ cancelled: true });
  } catch (error) {
    return fail("cancel club deletion request", error);
  }
}
