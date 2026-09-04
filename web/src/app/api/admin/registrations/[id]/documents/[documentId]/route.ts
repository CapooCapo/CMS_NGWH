import { requireRole, requireViewer } from "@/server/auth/guard";
import {
  findRegistrationDocument,
  setDocumentVisibility,
} from "@/server/repositories/registrations";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

/**
 * REQ-REG-003 — serves an uploaded document to reviewers.
 *
 * Uploads are stored as bytes in the database, never under a public directory,
 * so this authenticated route is the only way to read one. The response forces
 * a download with a fixed `attachment` disposition and
 * `X-Content-Type-Options: nosniff`, so an uploaded HTML/SVG payload cannot
 * execute in the admin's origin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const guard = await requireViewer("editor");
  if (!guard.ok) return guard.response;

  const { id: rawId, documentId: rawDoc } = await params;
  const id = parseId(rawId);
  const documentId = parseId(rawDoc);
  if (!id || !documentId) return notFound();

  try {
    const doc = await findRegistrationDocument(id, documentId);
    if (!doc) return notFound();

    // The filename was sanitised on upload; encode it again for the header.
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
    return fail("download registration document", error);
  }
}

/**
 * Publishes or unpublishes one document onto the associated club's public
 * profile (see migration 004). Gated the same as BR-001 approval itself
 * (`requireRole()` = admin/superadmin) since this is the same kind of "make
 * this visible to the world" decision, not a routine content edit.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;

  const { id: rawId, documentId: rawDoc } = await params;
  const id = parseId(rawId);
  const documentId = parseId(rawDoc);
  if (!id || !documentId) return notFound();

  try {
    const body = await readJson(request);
    const isPublic = body.isPublic === true;
    const doc = await setDocumentVisibility(id, documentId, isPublic);
    if (!doc) return notFound();
    return ok({ document: doc });
  } catch (error) {
    return fail("update registration document visibility", error);
  }
}
