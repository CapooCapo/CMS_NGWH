import { requireRole } from "@/server/auth/guard";
import { setContactStatus } from "@/server/repositories/contact";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { Validator, readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("editor");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const v = new Validator(await readJson(request));
    v.only(["status"]);
    const status =
      v.enum("status", ["new", "read", "archived"] as const, { required: true }) ??
      "new";
    v.assert();
    const message = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "contact.update", resourceType: "contact", resourceId: id, metadata: { status } },
      () => setContactStatus(id, status),
      Boolean
    );
    if (!message) return notFound();
    return ok({ message });
  } catch (error) {
    return fail("update contact message", error);
  }
}
