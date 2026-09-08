import { requireRole } from "@/server/auth/guard";
import { adjustLiveMatch, updateLiveScore } from "@/server/services/liveMatchUpdates";
import { parseScore, parseScoreAdjustment } from "@/server/validation/admin";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { NextResponse } from "next/server";
import { readJson } from "@/server/validation/validate";
import { auditedAdminMutation } from "@/server/security/adminAudit";

/**
 * Live scoreboard update (REQ-HOME-005 feed).
 *
 * `operator` is allowed here — running a scoreboard is the one job that does
 * not need full admin rights. The endpoint can only change score, status and
 * period; it cannot rewrite the fixture, so an operator cannot silently move a
 * game or swap teams mid-match.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("operator", "editor");
  if (!guard.ok) return guard.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const body = await readJson(request);
    if ("team" in body || "side" in body || "delta" in body || "kind" in body) {
      const input = parseScoreAdjustment(body);
      const result = await auditedAdminMutation(
        request,
        { actorId: guard.admin.id, action: "match.score.update", resourceType: "match", resourceId: id, metadata: { kind: input.kind, team: input.team } },
        () => adjustLiveMatch(id, input.team, input.kind, input.delta),
        (update) => Boolean(update.match)
      );
      if (result.scoreRejected) {
        return NextResponse.json({ error: "scoreOutOfRange" }, { status: 409 });
      }
      if (!result.match) return notFound();
      return ok({ match: result.match });
    }
    const input = parseScore(body);
    const match = await auditedAdminMutation(
      request,
      { actorId: guard.admin.id, action: "match.score.update", resourceType: "match", resourceId: id, metadata: { changed: ["homeScore", "awayScore", "status", "period"] } },
      () => updateLiveScore(
        id,
        input.homeScore,
        input.awayScore,
        input.status,
        input.period
      ),
      Boolean
    );
    if (!match) return notFound();
    return ok({ match });
  } catch (error) {
    return fail("update score", error);
  }
}
