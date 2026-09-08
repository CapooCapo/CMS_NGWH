import { requireRole, requireViewer } from "@/server/auth/guard";
import { createSeason, listSeasons } from "@/server/repositories/seasons";
import { parseSeason } from "@/server/validation/admin";
import { fail, ok } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

export async function GET() {
  const guard = await requireViewer("editor", "operator");
  if (!guard.ok) return guard.response;
  try {
    return ok({ seasons: await listSeasons() });
  } catch (error) {
    return fail("list seasons", error);
  }
}

export async function POST(request: Request) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  try {
    const input = parseSeason(await readJson(request));
    const season = await auditedAdminMutation(
      request,
      (created) => ({ actorId: guard.admin.id, action: "season.create", resourceType: "season", resourceId: created?.id ?? "new" }),
      () => createSeason(input),
      Boolean
    );
    if (!season) throw new Error("season creation returned no record");
    return ok({ season }, 201);
  } catch (error) {
    return fail("create season", error);
  }
}
