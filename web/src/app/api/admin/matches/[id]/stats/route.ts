import { requireRole, requireViewer } from "@/server/auth/guard";
import { findMatchById } from "@/server/repositories/matches";
import { listMatchStats, upsertStatLine } from "@/server/repositories/stats";
import { parseStatLine } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

/** REQ-TOURN-003 — per-match player stat lines (points and assists only). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireViewer("editor", "operator");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return ok({ stats: await listMatchStats(id) });
  } catch (error) {
    return fail("list match stats", error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("editor", "operator");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    if (!(await findMatchById(id))) return notFound();
    const stat = await upsertStatLine(id, parseStatLine(await readJson(request)));
    return ok({ stat }, 201);
  } catch (error) {
    return fail("create match stat", error);
  }
}
