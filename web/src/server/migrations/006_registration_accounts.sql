-- Migration 006 — authenticated club registration, and the registrant
-- becoming Club Owner + Head Coach on approval.
--
-- Workflow this enables (REQ-REG-001/002/004, and the "đăng nhập → đăng ký CLB
-- → duyệt → HLV trưởng" product flow):
--
--   sign up  →  log in  →  submit club registration  →  PENDING
--            →  admin approves  →  clubs.owner_id = the registrant
--                               +  a head-coach club_members row for them
--
-- Deliberately NOT a new identity table. `club_owners` (migration 005) already
-- models "an account which may or may not have a club yet" — `clubs.owner_id`
-- is nullable and `requireOwnedClub()` already has a first-class
-- "noClubAssigned" state for it. Adding a parallel `users` table would mean
-- two password/session stacks for one kind of human, so `club_owners` becomes
-- the account a person signs up for, and club ownership stays what it always
-- was: a nullable link from the club side.

-- Self-service signup collects a real name; it is what the person is called
-- as Head Coach. Nullable because migration-005-era accounts (created by an
-- admin, email only) predate it.
ALTER TABLE club_owners ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Who submitted this registration. The server always fills this from the
-- authenticated session, never from the request body — a client cannot claim
-- to be someone else's registrant. Nullable: registrations captured before
-- this migration have no account behind them, and admins can still review
-- them; only `NOT NULL`-worthy going forward, enforced in the API rather than
-- the column so legacy rows stay readable.
ALTER TABLE club_registrations ADD COLUMN IF NOT EXISTS club_owner_id INTEGER
  REFERENCES club_owners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS club_registrations_club_owner_idx
  ON club_registrations (club_owner_id);

-- At most one registration in flight per account: a person cannot spam the
-- review queue, and "my registration" is therefore unambiguous. Approved and
-- rejected rows are excluded so a rejected applicant can re-apply and an
-- approved one keeps their historical row.
CREATE UNIQUE INDEX IF NOT EXISTS club_registrations_one_pending_per_owner_idx
  ON club_registrations (club_owner_id)
  WHERE club_owner_id IS NOT NULL AND status = 'pending';

-- Ties a roster/staff row to an account, so the registrant's Head Coach entry
-- is *their own* identity rather than a name someone retyped. Nullable
-- because the overwhelming majority of members (players, other coaches) have
-- no login at all.
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS club_owner_id INTEGER
  REFERENCES club_owners(id) ON DELETE SET NULL;

-- Head coach is a distinction *within* the existing coach role, not a fourth
-- member_role: making it a flag keeps the `member_role IN
-- ('player','coach','staff')` CHECK — and every UI switch over it — untouched.
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS is_head_coach BOOLEAN NOT NULL
  DEFAULT FALSE;

-- One head coach per club, and only a coach may be one.
CREATE UNIQUE INDEX IF NOT EXISTS club_members_one_head_coach_per_club_idx
  ON club_members (club_id) WHERE is_head_coach;

ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_head_coach_is_coach;
ALTER TABLE club_members ADD CONSTRAINT club_members_head_coach_is_coach
  CHECK (NOT is_head_coach OR member_role = 'coach');
