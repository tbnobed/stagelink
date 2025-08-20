-- Migration script to update existing Virtual Audience database to v2.0
-- Run this on production database to add missing tables, columns, and chat system

-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'engineer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('individual', 'broadcast', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update users table to use proper types and add missing columns
DO $$ BEGIN
    -- Update role column to use enum if it's not already
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role' AND data_type='character varying') THEN
        ALTER TABLE "users" ALTER COLUMN "role" TYPE user_role USING role::user_role;
        RAISE NOTICE 'Updated users.role column to enum type';
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
        ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
        RAISE NOTICE 'Added updated_at column to users table';
    END IF;
END $$;

-- Create session_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS "session_tokens" (
        "id" text PRIMARY KEY NOT NULL,
        "link_id" text,
        "link_type" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp NOT NULL,
        "created_by" integer REFERENCES "users"("id")
);

-- Create viewer_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS "viewer_links" (
        "id" varchar PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        "session_token" varchar,
        CONSTRAINT "viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Create generated_viewer_links table if it doesn't exist (alternative naming)
CREATE TABLE IF NOT EXISTS "generated_viewer_links" (
        "id" varchar PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        "session_token" varchar,
        CONSTRAINT "generated_viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Create short_viewer_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS "short_viewer_links" (
        "id" varchar(6) PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "session_token" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp,
        "created_by" integer NOT NULL,
        CONSTRAINT "short_viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Add missing updated_at column to users table if it doesn't exist
DO $$ BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
        ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
        RAISE NOTICE 'Added updated_at column to users table';
    END IF;
END $$;

-- Add session_token column to links table if it doesn't exist - handle both old and new table names
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='generated_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_links' AND column_name='session_token') THEN
            ALTER TABLE "generated_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to generated_links table';
        END IF;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='links' AND column_name='session_token') THEN
            ALTER TABLE "links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to links table';
        END IF;
    END IF;
END $$;

-- Add session_token column to viewer_links table if it doesn't exist - handle both old and new table names
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='generated_viewer_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_viewer_links' AND column_name='session_token') THEN
            ALTER TABLE "generated_viewer_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to generated_viewer_links table';
        END IF;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='viewer_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewer_links' AND column_name='session_token') THEN
            ALTER TABLE "viewer_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to viewer_links table';
        END IF;
    END IF;
END $$;

-- Add session_token column to short_links table if it doesn't exist
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='short_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_links' AND column_name='session_token') THEN
            ALTER TABLE "short_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to short_links table';
        END IF;
    END IF;
END $$;

-- Create chat system tables if they don't exist
CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        "session_id" text NOT NULL,
        "sender_id" integer REFERENCES "users"("id"),
        "sender_name" text NOT NULL,
        "recipient_id" integer REFERENCES "users"("id"),
        "message_type" message_type DEFAULT 'individual' NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "chat_participants" (
        "id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        "session_id" text NOT NULL,
        "user_id" integer REFERENCES "users"("id"),
        "username" text NOT NULL,
        "role" user_role NOT NULL,
        "is_online" boolean DEFAULT true NOT NULL,
        "joined_at" timestamp DEFAULT now() NOT NULL,
        "last_seen_at" timestamp DEFAULT now() NOT NULL
);

-- Update short_viewer_links table structure to match schema
DROP TABLE IF EXISTS "short_viewer_links";
CREATE TABLE IF NOT EXISTS "short_viewer_links" (
        "id" text PRIMARY KEY NOT NULL,
        "return_feed" text NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "session_token" text UNIQUE,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp,
        "created_by" integer REFERENCES "users"("id")
);

-- Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS "session_tokens_link_id_idx" ON "session_tokens" ("link_id");
CREATE INDEX IF NOT EXISTS "session_tokens_link_type_idx" ON "session_tokens" ("link_type");
CREATE INDEX IF NOT EXISTS "session_tokens_expires_at_idx" ON "session_tokens" ("expires_at");

-- Chat system indexes
CREATE INDEX IF NOT EXISTS "chat_messages_session_id_idx" ON "chat_messages" ("session_id");
CREATE INDEX IF NOT EXISTS "chat_messages_sender_id_idx" ON "chat_messages" ("sender_id");
CREATE INDEX IF NOT EXISTS "chat_messages_created_at_idx" ON "chat_messages" ("created_at");
CREATE INDEX IF NOT EXISTS "chat_participants_session_id_idx" ON "chat_participants" ("session_id");
CREATE INDEX IF NOT EXISTS "chat_participants_user_id_idx" ON "chat_participants" ("user_id");
CREATE INDEX IF NOT EXISTS "chat_participants_is_online_idx" ON "chat_participants" ("is_online");

-- Link table indexes for performance
CREATE INDEX IF NOT EXISTS "generated_links_expires_at_idx" ON "generated_links" ("expires_at");
CREATE INDEX IF NOT EXISTS "generated_links_created_by_idx" ON "generated_links" ("created_by");
CREATE INDEX IF NOT EXISTS "short_links_expires_at_idx" ON "short_links" ("expires_at");
CREATE INDEX IF NOT EXISTS "short_links_created_by_idx" ON "short_links" ("created_by");
CREATE INDEX IF NOT EXISTS "viewer_links_expires_at_idx" ON "viewer_links" ("expires_at");
CREATE INDEX IF NOT EXISTS "viewer_links_created_by_idx" ON "viewer_links" ("created_by");
CREATE INDEX IF NOT EXISTS "short_viewer_links_expires_at_idx" ON "short_viewer_links" ("expires_at");
CREATE INDEX IF NOT EXISTS "short_viewer_links_created_by_idx" ON "short_viewer_links" ("created_by");

-- Verify all required tables exist
SELECT 
    'Database Migration v2.0 Verification' as status,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN (
            'users', 'generated_links', 'short_links', 'viewer_links', 'short_viewer_links',
            'session_tokens', 'chat_messages', 'chat_participants', 'session'
        )) = 9 
        THEN 'SUCCESS: All tables present'
        ELSE 'ERROR: Missing tables'
    END as result;

-- List all migrated tables
SELECT table_name, 
       CASE WHEN table_name = 'session' THEN 'Session storage'
            WHEN table_name = 'users' THEN 'User authentication'
            WHEN table_name = 'generated_links' THEN 'Main streaming links'
            WHEN table_name = 'short_links' THEN 'Shortened streaming links'
            WHEN table_name = 'viewer_links' THEN 'Viewer-only links'
            WHEN table_name = 'short_viewer_links' THEN 'Shortened viewer links'
            WHEN table_name = 'session_tokens' THEN 'Session token security'
            WHEN table_name = 'chat_messages' THEN 'Chat system messages'
            WHEN table_name = 'chat_participants' THEN 'Chat system participants'
       END as description
FROM information_schema.tables 
WHERE table_name IN ('users', 'generated_links', 'short_links', 'viewer_links', 'short_viewer_links', 'session_tokens', 'chat_messages', 'chat_participants', 'session')
ORDER BY table_name;

\echo 'Virtual Audience Platform v2.0 migration completed successfully with chat system support';