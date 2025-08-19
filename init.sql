-- Initialize Virtual Audience Database

-- Create database if not exists
SELECT 'CREATE DATABASE virtual_audience'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'virtual_audience');

-- Connect to the database
\c virtual_audience;

-- Create users table for session management (if using database sessions)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for session storage
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

-- Add primary key and index for sessions
ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- Create generated_links table matching Drizzle schema
CREATE TABLE IF NOT EXISTS generated_links (
    id TEXT PRIMARY KEY,
    stream_name TEXT NOT NULL,
    return_feed TEXT NOT NULL,
    chat_enabled BOOLEAN NOT NULL DEFAULT false,
    url TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Create index for efficient expiration cleanup
CREATE INDEX IF NOT EXISTS idx_generated_links_expires_at ON generated_links (expires_at);
CREATE INDEX IF NOT EXISTS idx_generated_links_created_at ON generated_links (created_at);

-- Insert default admin user (password: 'admin123' - change this!)
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2b$10$rKjzWd1qGJ4kGHZyGZyU4.Lf8QqKZu2YMHnj4K1wX.GHZyGZyU4L2') 
ON CONFLICT (username) DO NOTHING;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;