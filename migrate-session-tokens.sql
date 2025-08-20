-- Migration script to add session token support to existing Virtual Audience database
-- Run this on production database to add missing tables and columns

-- Create session_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS "session_tokens" (
        "id" varchar PRIMARY KEY NOT NULL,
        "link_id" varchar NOT NULL,
        "link_type" varchar NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        CONSTRAINT "session_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Add session_token column to links table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='links' AND column_name='session_token') THEN
        ALTER TABLE "links" ADD COLUMN "session_token" varchar;
    END IF;
END $$;

-- Add session_token column to viewer_links table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewer_links' AND column_name='session_token') THEN
        ALTER TABLE "viewer_links" ADD COLUMN "session_token" varchar;
    END IF;
END $$;

-- Add session_token column to short_links table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_links' AND column_name='session_token') THEN
        ALTER TABLE "short_links" ADD COLUMN "session_token" varchar;
    END IF;
END $$;

-- Fix short_viewer_links table structure
-- First drop the table if it exists with wrong structure
DROP TABLE IF EXISTS "short_viewer_links";

-- Create short_viewer_links table with correct structure
CREATE TABLE IF NOT EXISTS "short_viewer_links" (
        "id" varchar(6) PRIMARY KEY NOT NULL,
        "viewer_link_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "session_token" varchar,
        CONSTRAINT "short_viewer_links_viewer_link_id_viewer_links_id_fk" FOREIGN KEY ("viewer_link_id") REFERENCES "viewer_links"("id") ON DELETE cascade ON UPDATE no action
);

-- Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS "session_tokens_link_id_idx" ON "session_tokens" ("link_id");
CREATE INDEX IF NOT EXISTS "session_tokens_link_type_idx" ON "session_tokens" ("link_type");
CREATE INDEX IF NOT EXISTS "session_tokens_expires_at_idx" ON "session_tokens" ("expires_at");

-- Verify tables exist
SELECT 'session_tokens' as table_name, COUNT(*) as exists FROM information_schema.tables WHERE table_name='session_tokens'
UNION ALL
SELECT 'session_token in links', COUNT(*) FROM information_schema.columns WHERE table_name='links' AND column_name='session_token'
UNION ALL
SELECT 'session_token in viewer_links', COUNT(*) FROM information_schema.columns WHERE table_name='viewer_links' AND column_name='session_token'
UNION ALL
SELECT 'session_token in short_links', COUNT(*) FROM information_schema.columns WHERE table_name='short_links' AND column_name='session_token'
UNION ALL
SELECT 'short_viewer_links', COUNT(*) FROM information_schema.tables WHERE table_name='short_viewer_links';

\echo 'Session token migration completed successfully';