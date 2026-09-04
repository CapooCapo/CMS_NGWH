import { requireRole, requireViewer } from "@/server/auth/guard";
import { createClub, listClubs } from "@/server/repositories/clubs";
import { parseClub } from "@/server/validation/admin";
import { fail, ok } from "@/server/api/respond";
import { readJson } from "@/server/validation/validate";

/** Admin club list — unlike the public directory this includes unapproved clubs. */
export async function GET(request: Request) {
  const guard = await requireViewer("editor");
  if (!guard.ok) return guard.response;
  try {
    const url = new URL(request.url);
    const { rows, total } = await listClubs({
      approvedOnly: false,
      search: url.searchParams.get("q"),
      province: url.searchParams.get("province"),
      limit: 100,
    });
    return ok({ clubs: rows, total });
  } catch (error) {
    return fail("list clubs (admin)", error);
  }
}

export async function POST(request: Request) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;
  try {
    const club = await createClub(parseClub(await readJson(request)));
    return ok({ club }, 201);
  } catch (error) {
    return fail("create club", error);
  }
}
