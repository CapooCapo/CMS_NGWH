import "server-only";
import {
  approveRegistration,
  deleteRegistration,
  rejectRegistration,
} from "./registrationReview";

export type BulkRegistrationAction = "approve" | "reject" | "delete";

export type BulkRegistrationResult = {
  id: number;
  ok: boolean;
  reason?: string;
};

/**
 * Coordinates independent registration transactions. Each individual domain
 * operation owns its own lock and transaction, so one ownership conflict or
 * invalid transition never rolls back unrelated selections.
 */
export async function applyBulkRegistrationAction(
  ids: readonly number[],
  action: BulkRegistrationAction,
  afterSuccess?: (id: number) => Promise<void>
): Promise<BulkRegistrationResult[]> {
  const results: BulkRegistrationResult[] = [];

  for (const id of ids) {
    if (action === "approve") {
      const result = await approveRegistration(id, async () => afterSuccess?.(id));
      results.push(
        result.kind === "approved"
          ? { id, ok: true }
          : { id, ok: false, reason: result.kind }
      );
      continue;
    }

    if (action === "reject") {
      const result = await rejectRegistration(id, async () => afterSuccess?.(id));
      results.push(
        result.kind === "rejected"
          ? { id, ok: true }
          : { id, ok: false, reason: result.kind }
      );
      continue;
    }

    const result = await deleteRegistration(id, async () => afterSuccess?.(id));
    results.push(
      result.kind === "deleted"
        ? { id, ok: true }
        : { id, ok: false, reason: result.kind }
    );
  }

  return results;
}
