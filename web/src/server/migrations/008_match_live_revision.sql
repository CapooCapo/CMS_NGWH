-- A row-local, monotonic version for public live-score events. `updated_at`
-- is a timestamp and therefore cannot safely order concurrent transactions.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS live_revision INTEGER NOT NULL DEFAULT 0;
