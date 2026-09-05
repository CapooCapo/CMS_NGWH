-- Owner-initiated club deletion is an explicit, revocable request. Only an
-- administrator performs the final delete.
CREATE TABLE IF NOT EXISTS club_deletion_requests (
  club_id      INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES club_owners(id) ON DELETE RESTRICT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_deletion_requests_requested_at_idx
  ON club_deletion_requests (requested_at ASC);
