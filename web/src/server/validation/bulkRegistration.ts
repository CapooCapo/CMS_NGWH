import "server-only";
import { ValidationError } from "./validate";
import type { BulkRegistrationAction } from "@/server/services/bulkRegistrationActions";

const ACTIONS = ["approve", "reject", "delete"] as const;
const MAX_BULK_IDS = 100;

export function parseBulkRegistrationAction(body: Record<string, unknown>): {
  action: BulkRegistrationAction;
  ids: number[];
} {
  const errors: Record<string, string> = {};
  const action = body.action;
  const ids = body.ids;

  for (const key of Object.keys(body)) {
    if (key !== "action" && key !== "ids" && key !== "confirmation") errors[key] = "unexpected";
  }

  if (!ACTIONS.includes(action as BulkRegistrationAction)) errors.action = "invalidChoice";
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK_IDS) {
    errors.ids = "invalidChoice";
  } else if (!ids.every((id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0)) {
    errors.ids = "invalidChoice";
  } else if (new Set(ids).size !== ids.length) {
    errors.ids = "duplicate";
  }
  if (action === "delete" && body.confirmation !== "DELETE") {
    errors.confirmation = "invalidChoice";
  }
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);

  return { action: action as BulkRegistrationAction, ids: ids as number[] };
}
