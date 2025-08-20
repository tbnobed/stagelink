-- Virtual Audience Platform v2.0 with Authentication and Session Token Support
-- Clean initialization for Docker deployment - UPDATED with session token fixes
-- Fixed: Added session_token columns to short_links and short_viewer_links tables

-- Create database if not exists
SELECT 'CREATE DATABASE virtual_audience'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'virtual_audience');

-- Connect to the database
\c virtual_audience;

-- Clean slate: Drop existing schema for fresh deployment
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Grant all privileges to postgres user for Drizzle operations
GRANT ALL PRIVILEGES ON DATABASE virtual_audience TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Allow future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

-- Create full database schema for Virtual Audience Platform v2.0

-- Session storage table for authentication sessions
CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar PRIMARY KEY NOT NULL,
        "sess" jsonb NOT NULL,
        "expire" timestamp NOT NULL
);

-- Users table with authentication support
CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "username" varchar NOT NULL,
        "email" varchar,
        "password" varchar NOT NULL,
        "role" varchar DEFAULT 'user' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "users_username_unique" UNIQUE("username")
);

-- Links table for streaming session management
CREATE TABLE IF NOT EXISTS "links" (
        "id" varchar PRIMARY KEY NOT NULL,
        "stream_name" varchar NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        "session_token" varchar,
        CONSTRAINT "links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Short links table for URL shortening
CREATE TABLE IF NOT EXISTS "short_links" (
        "id" varchar(6) PRIMARY KEY NOT NULL,
        "link_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "session_token" varchar,
        CONSTRAINT "short_links_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE cascade ON UPDATE no action
);

-- Viewer links table for studio monitoring
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

-- Short viewer links table for URL shortening
CREATE TABLE IF NOT EXISTS "short_viewer_links" (
        "id" varchar(6) PRIMARY KEY NOT NULL,
        "viewer_link_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "session_token" varchar,
        CONSTRAINT "short_viewer_links_viewer_link_id_viewer_links_id_fk" FOREIGN KEY ("viewer_link_id") REFERENCES "viewer_links"("id") ON DELETE cascade ON UPDATE no action
);

-- Session tokens table for reusable link security
CREATE TABLE IF NOT EXISTS "session_tokens" (
        "id" varchar PRIMARY KEY NOT NULL,
        "link_id" varchar NOT NULL,
        "link_type" varchar NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        CONSTRAINT "session_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
CREATE INDEX IF NOT EXISTS "session_tokens_link_id_idx" ON "session_tokens" ("link_id");
CREATE INDEX IF NOT EXISTS "session_tokens_link_type_idx" ON "session_tokens" ("link_type");
CREATE INDEX IF NOT EXISTS "session_tokens_expires_at_idx" ON "session_tokens" ("expires_at");

-- Create default admin user (password: password - MUST be changed in production)
INSERT INTO "users" ("username", "email", "password", "role")
VALUES ('admin', 'admin@stagelinq.com', 'c0d8b0e936e6b11b04f9b57eee62d387.9c5e1e96e8c00e5b4b6e8c51c9b6c8b1a2e8c9b6e8c00e5b4b6e8c51c9b6c8b1', 'admin')
ON CONFLICT ("username") DO NOTHING;

-- Notify successful initialization
\echo 'Virtual Audience Platform v2.0 database schema initialized successfully with session token support';