import { requireRole } from "@/server/auth/guard";
import {
  adjustLiveMatch,
  scoreAuditMetadata,
  updateLiveScore,
} from "@/server/services/liveMatchUpdates";
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
        (update) => ({
          actorId: guard.admin.id,
          action: "match.score.update",
          resourceType: "match",
          resourceId: id,
          metadata: update.match ? scoreAuditMetadata(update.before, update.after) ?? {} : {},
        }),
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
    const result = await auditedAdminMutation(
      request,
      (update) => ({
        actorId: guard.admin.id,
        action: "match.score.update",
        resourceType: "match",
        resourceId: id,
        metadata: update
          ? scoreAuditMetadata(update.before, update.after, { includeUnchangedScore: true }) ?? {}
          : {},
      }),
      () => updateLiveScore(
        id,
        input.homeScore,
        input.awayScore,
        input.status,
        input.period
      ),
      Boolean
    );
    if (!result) return notFound();
    return ok({ match: result.match });
  } catch (error) {
    return fail("update score", error);
  }
}
