import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAuditMetadata } from "../src/lib/auditMetadata";

const labels = {
  score: "Score",
  homeFouls: "Home fouls",
  awayFouls: "Away fouls",
  status: "Status",
};

test("score audit metadata renders a readable score transition", () => {
  assert.equal(
    formatAuditMetadata(
      {
        changedFields: ["homeScore"],
        before: { homeScore: 1, awayScore: 0 },
        after: { homeScore: 2, awayScore: 0 },
      },
      "—",
      labels
    ),
    "Score: 1 - 0 → 2 - 0"
  );
});

test("foul audit metadata renders only the changed foul count", () => {
  assert.equal(
    formatAuditMetadata(
      {
        changedFields: ["homeFouls"],
        before: { homeFouls: 2 },
        after: { homeFouls: 3 },
      },
      "—",
      labels
    ),
    "Home fouls: 2 → 3"
  );
});

test("malformed nested metadata falls back to safe generic JSON", () => {
  assert.equal(
    formatAuditMetadata(
      { before: { homeScore: "not a score" }, after: { homeScore: "still not a score" } },
      "—",
      labels
    ),
    '{"before":{"homeScore":"not a score"},"after":{"homeScore":"still not a score"}}'
  );
});
