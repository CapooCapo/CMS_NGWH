-- Migration 005 — Club Owner accounts.
--
-- Explicit product decision for this pass: a Club Owner authenticated
-- self-service workflow is in scope (overriding the earlier BLOCKED status
-- recorded against OQ-012/OQ-013 in .ai/REQUIREMENTS.md — see
-- .ai/IMPLEMENTATION_PROGRESS.md for that decision trail). This migration
-- mirrors the existing staff-account design (`admin_users` / `admin_sessions`
-- from migration 002) exactly — same scrypt hash shape, same opaque
-- SHA-256-digested session token, same 12h TTL — but as a fully separate
-- table/session pair and cookie, not a new role bolted onto `admin_users`:
-- a club owner is a different kind of principal (scoped to exactly one club,
-- never staff-privileged), and keeping the identity spaces apart means the
-- well-tested staff RBAC invariants (`permissions.ts`) are untouched.
--
-- There is still no public sign-up path: an owner account is created (and
-- linked to a club) by an admin, deterministically — never by a client
-- asserting its own user id or club id (see `clubOwners.ts` / the admin
-- "Club Owner account" panel).
CREATE TABLE IF NOT EXISTS club_owners (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_owners_email_lower_idx
  ON club_owners (LOWER(email));

CREATE TABLE IF NOT EXISTS club_owner_sessions (
  token_hash    TEXT PRIMARY KEY,
  club_owner_id INTEGER NOT NULL REFERENCES club_owners(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_owner_sessions_owner_idx
  ON club_owner_sessions (club_owner_id);
CREATE INDEX IF NOT EXISTS club_owner_sessions_expires_idx
  ON club_owner_sessions (expires_at);

-- One owner account may own at most one club (the product workflow this pass
-- implements is single-club ownership — REQ-CLUB-005 style "roster exists per
-- club", not a multi-club portfolio). `ON DELETE SET NULL` so deleting an
-- owner account never deletes or orphans club data.
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS owner_id INTEGER
  REFERENCES club_owners(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clubs_owner_id_unique_idx
  ON clubs (owner_id) WHERE owner_id IS NOT NULL;

DO $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS club_owners_set_updated_at ON club_owners; '
    'CREATE TRIGGER club_owners_set_updated_at BEFORE UPDATE ON club_owners '
    'FOR EACH ROW EXECUTE FUNCTION set_updated_at();');
END $$;
