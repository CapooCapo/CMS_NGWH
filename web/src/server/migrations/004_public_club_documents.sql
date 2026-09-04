-- Migration 004 — let a reviewer publish one uploaded registration document
-- (the capability profile / U20 athlete list, REQ-REG-003) onto the club's
-- public profile page.
--
-- ASSUMPTION (documents a gap, does not invent a requirement): REQ-CLUB-004/005/006
-- name achievements/roster/contact as public profile content but say nothing about
-- documents, and OQ-011 covers only upload validation, not visibility. Every uploaded
-- document defaults to private (admin-only, unchanged from migration 002) — a document
-- only becomes reachable at a public URL once a reviewer explicitly opts it in here.
-- Nothing is exposed by this migration alone.
ALTER TABLE registration_documents
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
