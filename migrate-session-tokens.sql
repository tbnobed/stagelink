-- Migration script to update existing Virtual Audience database to v2.4
-- Run this on production database to add missing tables, columns, and chat system
-- Includes: assigned_server columns for multi-server WHIP load balancing

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
        "id" text PRIMARY KEY NOT NULL,
        "return_feed" text NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "session_token" text UNIQUE,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp,
        "created_by" integer REFERENCES "users"("id")
);

-- Create generated_viewer_links table if it doesn't exist (alternative naming)
CREATE TABLE IF NOT EXISTS "generated_viewer_links" (
        "id" text PRIMARY KEY NOT NULL,
        "return_feed" text NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "session_token" text UNIQUE,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp,
        "created_by" integer REFERENCES "users"("id")
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
            ALTER TABLE "generated_links" ADD COLUMN "session_token" text UNIQUE;
            RAISE NOTICE 'Added session_token column to generated_links table';
        END IF;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='links' AND column_name='session_token') THEN
            ALTER TABLE "links" ADD COLUMN "session_token" text UNIQUE;
            RAISE NOTICE 'Added session_token column to links table';
        END IF;
    END IF;
END $$;

-- Add session_token column to viewer_links table if it doesn't exist - handle both old and new table names
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='generated_viewer_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_viewer_links' AND column_name='session_token') THEN
            ALTER TABLE "generated_viewer_links" ADD COLUMN "session_token" text UNIQUE;
            RAISE NOTICE 'Added session_token column to generated_viewer_links table';
        END IF;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='viewer_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewer_links' AND column_name='session_token') THEN
            ALTER TABLE "viewer_links" ADD COLUMN "session_token" text UNIQUE;
            RAISE NOTICE 'Added session_token column to viewer_links table';
        END IF;
    END IF;
END $$;

-- Add session_token column to short_links table if it doesn't exist
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='short_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_links' AND column_name='session_token') THEN
            ALTER TABLE "short_links" ADD COLUMN "session_token" text UNIQUE;
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

-- Ensure short_viewer_links table exists with correct structure
CREATE TABLE IF NOT EXISTS "short_viewer_links" (
        "id" text PRIMARY KEY NOT NULL,
        "return_feed" text NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "session_token" text UNIQUE,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp,
        "created_by" integer REFERENCES "users"("id")
);

-- Add missing columns to short_viewer_links if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_viewer_links' AND column_name='session_token') THEN
        ALTER TABLE "short_viewer_links" ADD COLUMN "session_token" text UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_viewer_links' AND column_name='expires_at') THEN
        ALTER TABLE "short_viewer_links" ADD COLUMN "expires_at" timestamp;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_viewer_links' AND column_name='created_by') THEN
        ALTER TABLE "short_viewer_links" ADD COLUMN "created_by" integer REFERENCES "users"("id");
    END IF;
END $$;

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

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" text NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "used" boolean DEFAULT false NOT NULL
);

-- Registration tokens table for user invites
CREATE TABLE IF NOT EXISTS "registration_tokens" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text NOT NULL UNIQUE,
        "role" user_role DEFAULT 'user' NOT NULL,
        "token" text NOT NULL UNIQUE,
        "inviter_user_id" integer REFERENCES "users"("id"),
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "used" boolean DEFAULT false NOT NULL
);

-- Room system tables for multi-participant streaming
CREATE TABLE IF NOT EXISTS "rooms" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "description" text,
        "max_participants" integer DEFAULT 10,
        "chat_enabled" boolean DEFAULT true NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "room_participants" (
        "id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        "room_id" varchar NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
        "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
        "guest_name" text,
        "stream_name" text,
        "is_streaming" boolean DEFAULT false NOT NULL,
        "joined_at" timestamp DEFAULT now() NOT NULL,
        "last_seen_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "room_stream_assignments" (
        "id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        "room_id" varchar NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
        "stream_name" text NOT NULL,
        "assigned_user_id" integer REFERENCES "users"("id"),
        "assigned_guest_name" text,
        "position" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer REFERENCES "users"("id")
);

-- Consent system for US broadcast compliance (CCPA, BIPA, FCC)
DO $$ BEGIN
    CREATE TYPE consent_type AS ENUM ('camera_microphone', 'recording', 'broadcast', 'privacy_policy');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "consent_records" (
        "id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        "session_id" text,
        "user_id" integer REFERENCES "users"("id"),
        "guest_identifier" text,
        "consent_type" consent_type NOT NULL,
        "consent_text" text NOT NULL,
        "granted" boolean DEFAULT false NOT NULL,
        "ip_address" text,
        "user_agent" text,
        "stream_name" text,
        "granted_at" timestamp DEFAULT now() NOT NULL,
        "revoked_at" timestamp
);

-- Password reset and registration token indexes
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON "password_reset_tokens" ("token");
CREATE INDEX IF NOT EXISTS "registration_tokens_email_idx" ON "registration_tokens" ("email");
CREATE INDEX IF NOT EXISTS "registration_tokens_token_idx" ON "registration_tokens" ("token");

-- Room system indexes
CREATE INDEX IF NOT EXISTS "rooms_created_by_idx" ON "rooms" ("created_by");
CREATE INDEX IF NOT EXISTS "rooms_is_active_idx" ON "rooms" ("is_active");
CREATE INDEX IF NOT EXISTS "room_participants_room_id_idx" ON "room_participants" ("room_id");
CREATE INDEX IF NOT EXISTS "room_participants_user_id_idx" ON "room_participants" ("user_id");
CREATE INDEX IF NOT EXISTS "room_participants_is_streaming_idx" ON "room_participants" ("is_streaming");
CREATE INDEX IF NOT EXISTS "room_stream_assignments_room_id_idx" ON "room_stream_assignments" ("room_id");
CREATE INDEX IF NOT EXISTS "room_stream_assignments_stream_name_idx" ON "room_stream_assignments" ("stream_name");

-- Consent system indexes
CREATE INDEX IF NOT EXISTS "consent_records_user_id_idx" ON "consent_records" ("user_id");
CREATE INDEX IF NOT EXISTS "consent_records_guest_identifier_idx" ON "consent_records" ("guest_identifier");
CREATE INDEX IF NOT EXISTS "consent_records_stream_name_idx" ON "consent_records" ("stream_name");
CREATE INDEX IF NOT EXISTS "consent_records_consent_type_idx" ON "consent_records" ("consent_type");
CREATE INDEX IF NOT EXISTS "consent_records_granted_at_idx" ON "consent_records" ("granted_at");

-- Add assigned_server column for multi-server WHIP load balancing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_links' AND column_name='assigned_server') THEN
        ALTER TABLE "generated_links" ADD COLUMN "assigned_server" text;
        RAISE NOTICE 'Added assigned_server column to generated_links table';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_links' AND column_name='assigned_server') THEN
        ALTER TABLE "short_links" ADD COLUMN "assigned_server" text;
        RAISE NOTICE 'Added assigned_server column to short_links table';
    END IF;
END $$;

-- Verify all required tables exist
SELECT 
    'Database Migration v2.4 Verification' as status,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN (
            'users', 'generated_links', 'short_links', 'viewer_links', 'short_viewer_links',
            'session_tokens', 'chat_messages', 'chat_participants', 'session',
            'password_reset_tokens', 'registration_tokens',
            'rooms', 'room_participants', 'room_stream_assignments',
            'consent_records'
        )) = 15 
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
            WHEN table_name = 'password_reset_tokens' THEN 'Password reset tokens'
            WHEN table_name = 'registration_tokens' THEN 'User invite registration tokens'
            WHEN table_name = 'rooms' THEN 'Multi-participant rooms'
            WHEN table_name = 'room_participants' THEN 'Room participants'
            WHEN table_name = 'room_stream_assignments' THEN 'Room stream assignments'
            WHEN table_name = 'consent_records' THEN 'US broadcast consent records (CCPA/BIPA/FCC)'
       END as description
FROM information_schema.tables 
WHERE table_name IN ('users', 'generated_links', 'short_links', 'viewer_links', 'short_viewer_links', 'session_tokens', 'chat_messages', 'chat_participants', 'session', 'password_reset_tokens', 'registration_tokens', 'rooms', 'room_participants', 'room_stream_assignments', 'consent_records')
ORDER BY table_name;

\echo 'Virtual Audience Platform v2.4 migration completed successfully with rooms, consent system, multi-server load balancing, and US broadcast compliance support';