import { requireRole } from "@/server/auth/guard";
import {
  approveRegistration,
  rejectRegistration,
} from "@/server/services/registrationReview";
import { fail, notFound, ok, parseId } from "@/server/api/respond";
import { Validator, readJson } from "@/server/validation/validate";

/**
 * BR-001 / REQ-CLUB-003 — approve or reject a club registration.
 *
 * Approving publishes the club profile; rejecting only records the outcome.
 * OQ-010 (which role approves) is Open, so this is gated on `admin` as the
 * documented minimum — see src/server/services/registrationReview.ts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole();
  if (!guard.ok) return guard.response;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) return notFound();

  try {
    const body = await readJson(request);
    const v = new Validator(body);
    const action = v.enum("action", ["approved", "rejected"] as const, {
      required: true,
    });
    v.assert();

    if (action === "approved") {
      const result = await approveRegistration(id);
      if (result.kind === "notFound") return notFound();
      if (result.kind !== "approved") {
        return Response.json({ error: result.kind }, { status: 409 });
      }
      return ok({ registration: result.registration, clubId: result.clubId });
    }
    const result = await rejectRegistration(id);
    if (result.kind === "notFound") return notFound();
    if (result.kind !== "rejected") {
      return Response.json({ error: result.kind }, { status: 409 });
    }
    return ok({ registration: result.registration });
  } catch (error) {
    return fail("review registration", error);
  }
}
