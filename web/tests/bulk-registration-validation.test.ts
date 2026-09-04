import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBulkRegistrationAction } from "../src/server/validation/bulkRegistration";
import { ValidationError } from "../src/server/validation/validate";

test("bulk actions require a valid, non-empty, unique ID selection", () => {
  assert.deepEqual(parseBulkRegistrationAction({ action: "approve", ids: [1, 2] }), {
    action: "approve",
    ids: [1, 2],
  });
  for (const body of [
    { action: "approve", ids: [] },
    { action: "approve", ids: [1, 1] },
    { action: "approve", ids: ["1"] },
    { action: "unknown", ids: [1] },
  ]) {
    assert.throws(() => parseBulkRegistrationAction(body), ValidationError);
  }
});

test("bulk deletion requires the explicit DELETE confirmation", () => {
  assert.throws(
    () => parseBulkRegistrationAction({ action: "delete", ids: [1] }),
    ValidationError
  );
  assert.deepEqual(
    parseBulkRegistrationAction({ action: "delete", ids: [1], confirmation: "DELETE" }),
    { action: "delete", ids: [1] }
  );
});
