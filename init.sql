-- Virtual Audience Platform v2.0 with Authentication Support
-- Clean initialization for Docker deployment

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