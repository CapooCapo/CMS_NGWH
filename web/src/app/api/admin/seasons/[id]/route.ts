import { requireRole } from "@/server/auth/guard";
import { updateSeason } from "@/server/repositories/seasons";
import { parseSeason } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const input = parseSeason(await readJson(request));
    const season = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "season.update", resourceType: "season", resourceId: id, metadata: { changed: Object.keys(input) } },
      () => updateSeason(id, input),
      Boolean
    );
    if (!season) return notFound();
    return ok({ season });
  } catch (error) {
    return fail("update season", error);
  }
}
