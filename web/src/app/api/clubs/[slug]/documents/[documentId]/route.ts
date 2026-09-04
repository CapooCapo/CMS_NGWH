import { findClubBySlug } from "@/server/repositories/clubs";
import { findPublicClubDocument } from "@/server/repositories/registrations";
import { fail, notFound, parseId } from "@/server/api/respond";

/**
 * Serves a document belonging to an approved club. No session is required:
 * approval of the club, rather than an individual document flag, is the sole
 * public-visibility decision.
 *
 * Same anti-sniffing headers as the admin download: an uploaded HTML/SVG
 * payload must not be able to execute in this origin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; documentId: string }> }
) {
  const { slug, documentId: rawDoc } = await params;
  const documentId = parseId(rawDoc);
  if (!documentId) return notFound();

  try {
    // BR-001: an unapproved club's documents stay unreachable even if a
    // document was (mistakenly) marked public before the club was unpublished.
    const club = await findClubBySlug(slug, true);
    if (!club) return notFound();

    const doc = await findPublicClubDocument(club.id, documentId);
    if (!doc) return notFound();

    const safeName = encodeURIComponent(doc.filename);
    return new Response(new Uint8Array(doc.content), {
      headers: {
        "Content-Type": doc.content_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return fail("download public club document", error);
  }
}
