-- Migration 003 — add the `superadmin` and `subadmin` staff roles.
--
-- The role column is already TEXT with a CHECK constraint, so the table is not
-- redesigned: the constraint is replaced in place to admit two more values.
-- No existing row changes, and no existing role loses anything.
--
-- Hierarchy after this migration:
--   superadmin — system administrator; the only role that may manage
--                superadmin accounts.
--   admin      — business administrator. Unchanged permissions.
--   editor     — content and review. Unchanged.
--   operator   — scoreboard only. Unchanged.
--   subadmin   — read-only across admin-managed business content.
--
-- `DROP CONSTRAINT IF EXISTS` then `ADD` is safe to re-run: the migration
-- runner records applied files, and both statements are idempotent in effect.
-- Postgres validates the new constraint against existing rows on ADD, which is
-- what we want — it would fail loudly rather than silently admit bad data.
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('superadmin', 'admin', 'editor', 'operator', 'subadmin'));

-- Index the role column: every authorization decision that has to answer
-- "is this the last superadmin?" counts rows by role, and the staff list is
-- ordered and filtered by it.
CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users (role);
