import { requireRole } from "@/server/auth/guard";
import { fail, ok } from "@/server/api/respond";
import { applyBulkRegistrationAction } from "@/server/services/bulkRegistrationActions";
import { parseBulkRegistrationAction } from "@/server/validation/bulkRegistration";
import { readJson } from "@/server/validation/validate";

/** Admin-only orchestration for independent, state-safe registration actions. */
export async function POST(request: Request) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;

  try {
    const { action, ids } = parseBulkRegistrationAction(await readJson(request));
    const results = await applyBulkRegistrationAction(ids, action);
    const succeeded = results.filter((result) => result.ok).map((result) => result.id);
    const failed = results
      .filter((result) => !result.ok)
      .map(({ id, reason }) => ({ id, reason: reason ?? "server" }));
    return ok({ action, succeeded, failed, results });
  } catch (error) {
    return fail("bulk registration action", error);
  }
}
