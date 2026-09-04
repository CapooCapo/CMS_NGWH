-- NGWH application schema.
--
-- Scope boundary: Sanity owns editorial content (news, gallery, about,
-- partners). This database owns transactional/application data only.
-- Every table below traces to a requirement in .ai/REQUIREMENTS.md.

-- REQ-TOURN-004: Archives — list of past seasons.
CREATE TABLE IF NOT EXISTS seasons (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name_en      TEXT NOT NULL,
  name_vi      TEXT NOT NULL,
  starts_on    DATE,
  ends_on      DATE,
  -- upcoming | active | completed
  status       TEXT NOT NULL DEFAULT 'upcoming'
               CHECK (status IN ('upcoming', 'active', 'completed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- REQ-CLUB-001/002/004/005/006 + BR-001 (visible only once approved).
CREATE TABLE IF NOT EXISTS clubs (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  -- REQ-CLUB-002: filter by province/region.
  province      TEXT NOT NULL,
  founding_year INTEGER CHECK (founding_year BETWEEN 1800 AND 2200),
  logo_url      TEXT,
  achievements_en TEXT,
  achievements_vi TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url   TEXT,
  social_links  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- BR-001: a club profile is public only after its registration is approved.
  is_approved   BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clubs_province_idx ON clubs (province);
CREATE INDEX IF NOT EXISTS clubs_is_approved_idx ON clubs (is_approved);

-- REQ-CLUB-005: roster & coaching staff.
CREATE TABLE IF NOT EXISTS club_members (
  id          SERIAL PRIMARY KEY,
  club_id     INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  -- player | coach | staff
  member_role TEXT NOT NULL CHECK (member_role IN ('player', 'coach', 'staff')),
  shirt_number INTEGER CHECK (shirt_number BETWEEN 0 AND 99),
  position    TEXT,
  birth_year  INTEGER CHECK (birth_year BETWEEN 1900 AND 2200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_members_club_id_idx ON club_members (club_id);

-- REQ-REG-001/002: registration portal + standardized form.
-- Transactional submissions — deliberately NOT stored in Sanity.
CREATE TABLE IF NOT EXISTS club_registrations (
  id               SERIAL PRIMARY KEY,
  club_name        TEXT NOT NULL,
  operating_region TEXT NOT NULL,
  representative_name  TEXT NOT NULL,
  representative_email TEXT NOT NULL,
  representative_phone TEXT,
  notes            TEXT,
  -- BR-001 approval workflow states.
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note      TEXT,
  reviewed_at      TIMESTAMPTZ,
  -- Set once approved, linking the submission to the public club profile.
  club_id          INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_registrations_status_idx ON club_registrations (status);

-- REQ-TOURN-001 (schedule by date/time) and REQ-HOME-005 (Live & Results).
-- OQ-004 (closed): show the live match first, else the most recently finished.
CREATE TABLE IF NOT EXISTS matches (
  id             SERIAL PRIMARY KEY,
  season_id      INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  home_club_id   INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  away_club_id   INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  -- Free-text fallback so a fixture can be scheduled before both clubs exist.
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  venue          TEXT,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'live', 'completed', 'postponed', 'cancelled')),
  home_score     INTEGER NOT NULL DEFAULT 0 CHECK (home_score >= 0),
  away_score     INTEGER NOT NULL DEFAULT 0 CHECK (away_score >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matches_distinct_teams CHECK (
    home_club_id IS NULL OR away_club_id IS NULL OR home_club_id <> away_club_id
  )
);
CREATE INDEX IF NOT EXISTS matches_season_idx ON matches (season_id);
CREATE INDEX IF NOT EXISTS matches_scheduled_at_idx ON matches (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches (status);

-- Keep updated_at honest without relying on application code.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['seasons','clubs','club_registrations','matches'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I_set_updated_at ON %I; '
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t, t, t);
  END LOOP;
END $$;
