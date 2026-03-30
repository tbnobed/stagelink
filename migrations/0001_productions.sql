-- Migration: Productions & Capacity Management
-- Applied: 2024 (verified present in DB via direct SQL inspection)

-- Enum for production status
DO $$ BEGIN
  CREATE TYPE production_status AS ENUM ('draft', 'active', 'ended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Productions table
CREATE TABLE IF NOT EXISTS productions (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  scheduled_at    TIMESTAMP,
  status          production_status NOT NULL DEFAULT 'draft',
  max_live_participants INTEGER NOT NULL DEFAULT 128,
  return_feed     TEXT NOT NULL DEFAULT '',
  assigned_server TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by      INTEGER REFERENCES users(id)
);

-- Add production columns to generated_links
ALTER TABLE generated_links
  ADD COLUMN IF NOT EXISTS production_id VARCHAR REFERENCES productions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_name    TEXT,
  ADD COLUMN IF NOT EXISTS guest_email   TEXT;

-- Add production columns to short_links
ALTER TABLE short_links
  ADD COLUMN IF NOT EXISTS production_id VARCHAR REFERENCES productions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_name    TEXT,
  ADD COLUMN IF NOT EXISTS guest_email   TEXT;
