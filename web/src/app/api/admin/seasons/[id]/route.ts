import { requireRole } from "@/server/auth/guard";
import { updateSeason } from "@/server/repositories/seasons";
import { parseSeason } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const season = await updateSeason(id, parseSeason(await readJson(request)));
    if (!season) return notFound();
    return ok({ season });
  } catch (error) {
    return fail("update season", error);
  }
}
