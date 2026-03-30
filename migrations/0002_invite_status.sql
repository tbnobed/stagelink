-- Production Email Campaign: invite status columns on generated_links

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE generated_links
  ADD COLUMN IF NOT EXISTS invite_status invite_status,
  ADD COLUMN IF NOT EXISTS invited_at timestamp;
