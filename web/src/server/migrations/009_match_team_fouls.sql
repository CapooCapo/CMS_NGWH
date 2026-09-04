-- Public live-score state. Existing matches receive the zero defaults.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS home_fouls INTEGER NOT NULL DEFAULT 0 CHECK (home_fouls >= 0),
  ADD COLUMN IF NOT EXISTS away_fouls INTEGER NOT NULL DEFAULT 0 CHECK (away_fouls >= 0);
