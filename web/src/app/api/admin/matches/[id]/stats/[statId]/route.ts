import { requireRole } from "@/server/auth/guard";
import { deleteStatLine } from "@/server/repositories/stats";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { auditedAdminMutation } from "@/server/security/adminAudit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; statId: string }> }
) {
  const guard = await requireRole("editor", "operator");
  if (!guard.ok) return guard.response;
  const { id: rawId, statId: rawStat } = await params;
  const id = parseId(rawId);
  const statId = parseId(rawStat);
  if (!id || !statId) return notFound();
  try {
    const deleted = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "match.stat.delete", resourceType: "match_stat", resourceId: statId, metadata: { matchId: id } },
      () => deleteStatLine(id, statId),
      Boolean
    );
    if (!deleted) return notFound();
    return ok({ ok: true });
  } catch (error) {
    return fail("delete match stat", error);
  }
}
