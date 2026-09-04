-- Migration 002 — staff authentication, registration uploads, player stats and
-- contact submissions.
--
-- Scope boundary is unchanged: Sanity owns editorial content; this database
-- owns transactional/application data. Every table traces to a requirement or
-- business rule in .ai/REQUIREMENTS.md, with assumptions called out inline.

-- ---------------------------------------------------------------------------
-- Staff accounts.
--
-- ASSUMPTION (documents a gap, does not invent a requirement): .ai/REQUIREMENTS.md
-- contains no general user-account requirement and explicitly says Login /
-- Register / Forgot-Password are NOT requirements. However BR-001 ("club
-- profile shown only after registration approved") requires *somebody* to
-- approve, and OQ-010 asks which role that is — Open. A single internal
-- `admin` role is therefore modelled as the minimum needed to make BR-001
-- actionable. `role` is kept as a column so OQ-010 can be answered later
-- without a schema change. No public sign-up path exists.
CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT,
  -- scrypt, format: scrypt$N$r$p$<salt-b64>$<hash-b64>. Never a plaintext value.
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin'
                CHECK (role IN ('admin', 'editor', 'operator')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_lower_idx
  ON admin_users (LOWER(username));

-- Server-side sessions so a session can be revoked; the cookie carries only an
-- opaque random token and only its SHA-256 digest is stored here.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash    TEXT PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- REQ-REG-003 — upload of capability profile / U20 athlete list.
--
-- OQ-011 (format and size limits) is Open. Conservative documented defaults are
-- enforced in application code (see src/server/validation/registration.ts):
-- PDF / JPEG / PNG / XLSX, <= 10 MB each, <= 5 files per submission. Bytes are
-- stored in the database so uploads are never placed under a public directory;
-- they are readable only through an authenticated admin route.
CREATE TABLE IF NOT EXISTS registration_documents (
  id              SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL
                  REFERENCES club_registrations(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  byte_size       INTEGER NOT NULL CHECK (byte_size > 0),
  content         BYTEA NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registration_documents_registration_idx
  ON registration_documents (registration_id);

-- ---------------------------------------------------------------------------
-- REQ-TOURN-003 — statistics.
--
-- The requirement names exactly two categories: top scorer and top assists.
-- OQ-008 ("full statistics category list") is Open, so ONLY those two are
-- modelled here. Additional categories must not be invented; adding them later
-- is an additive column change once OQ-008 is answered.
CREATE TABLE IF NOT EXISTS match_player_stats (
  id             SERIAL PRIMARY KEY,
  match_id       INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  club_id        INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  club_member_id INTEGER REFERENCES club_members(id) ON DELETE SET NULL,
  -- Denormalised so a stat line survives a roster edit and can be recorded for
  -- a player who is not (yet) a club_members row.
  player_name    TEXT NOT NULL,
  points         INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  assists        INTEGER NOT NULL DEFAULT 0 CHECK (assists >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_player_stats_match_idx ON match_player_stats (match_id);
CREATE INDEX IF NOT EXISTS match_player_stats_club_idx ON match_player_stats (club_id);

-- ---------------------------------------------------------------------------
-- REQ-CONTACT-002 — contact / feedback form.
--
-- OQ-014 (which fields, and where submissions are routed) is Open. Submissions
-- are therefore persisted and surfaced in the admin inbox only; no email or
-- ticket routing is implemented, because the destination is undecided. Fields
-- are the conventional minimum and are all that the public form collects.
CREATE TABLE IF NOT EXISTS contact_messages (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT,
  message     TEXT NOT NULL,
  locale      TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'vi')),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages (created_at DESC);

-- ---------------------------------------------------------------------------
-- Match period, used by the live scoreboard console.
--
-- ASSUMPTION: no requirement specifies a game clock, quarter/period model or
-- OBS integration, so no clock is modelled. `period` is a plain label the
-- operator sets (e.g. "Q3", "OT") purely so the public Live & Results widget
-- (REQ-HOME-005) can show where a live game is. It is nullable and optional.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS period TEXT;

-- Keep updated_at honest for the new tables.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['admin_users','match_player_stats','contact_messages'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I_set_updated_at ON %I; '
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t, t, t);
  END LOOP;
END $$;
