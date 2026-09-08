import { requireRole, requireViewer } from "@/server/auth/guard";
import { createMatch, listAllMatches } from "@/server/repositories/matches";
import { parseMatch } from "@/server/validation/admin";
import { fail, ok } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

/** REQ-TOURN-001 — fixture management. */
export async function GET() {
  const guard = await requireViewer("editor", "operator");
  if (!guard.ok) return guard.response;
  try {
    return ok({ matches: await listAllMatches(200) });
  } catch (error) {
    return fail("list matches", error);
  }
}

export async function POST(request: Request) {
  const guard = await requireRole("editor");
  if (!guard.ok) return guard.response;
  try {
    const input = parseMatch(await readJson(request));
    const match = await auditedAdminMutation(
      request,
      (created) => ({ actorId: guard.admin.id, action: "match.create", resourceType: "match", resourceId: created?.id ?? "new" }),
      () => createMatch(input),
      Boolean
    );
    if (!match) throw new Error("match creation returned no record");
    return ok({ match }, 201);
  } catch (error) {
    return fail("create match", error);
  }
}
