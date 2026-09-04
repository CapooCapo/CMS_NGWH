-- Migration 007 — registrations submitted by an authenticated Club Owner
-- retain that identity. Legacy rows with a NULL `club_owner_id` remain valid
-- and continue through the legacy review path, but an identified registrant
-- cannot be deleted underneath a pending registration.
ALTER TABLE club_registrations
  DROP CONSTRAINT IF EXISTS club_registrations_club_owner_id_fkey;

ALTER TABLE club_registrations
  ADD CONSTRAINT club_registrations_club_owner_id_fkey
  FOREIGN KEY (club_owner_id) REFERENCES club_owners(id) ON DELETE RESTRICT;
