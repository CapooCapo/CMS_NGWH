import { requireOwnedClub } from "@/server/auth/ownerGuard";
import { findRegistrationDocumentForClub } from "@/server/repositories/registrations";
import { fail, notFound, parseId } from "@/server/api/respond";

/**
 * A Club Owner viewing one of their own club's documents — public or still
 * private. Scoped by `requireOwnedClub()` (never a client-supplied club id),
 * then by the document belonging to that specific club's registration, so
 * Owner A requesting Club B's document id gets 404, the same way the admin
 * and public document routes are scoped. Same anti-sniffing headers as those.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const guard = await requireOwnedClub();
  if (!guard.ok) return guard.response;

  const documentId = parseId((await params).documentId);
  if (!documentId) return notFound();

  try {
    const doc = await findRegistrationDocumentForClub(guard.club.id, documentId);
    if (!doc) return notFound();

    const safeName = encodeURIComponent(doc.filename);
    return new Response(new Uint8Array(doc.content), {
      headers: {
        "Content-Type": doc.content_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fail("download owner club document", error);
  }
}
