#!/bin/bash

# Fix Docker database schema mismatch
# This script creates the correct tables for the Virtual Audience Platform

echo "🔧 Fixing Docker database schema..."

# Create the proper schema using docker exec
docker exec virtual-audience-db-v2 psql -U postgres -d virtual_audience << 'EOF'

-- Drop conflicting tables if they exist
DROP TABLE IF EXISTS streaming_links;

-- Create the correct generated_links table matching our Drizzle schema
CREATE TABLE IF NOT EXISTS generated_links (
    id TEXT PRIMARY KEY,
    stream_name TEXT NOT NULL,
    return_feed TEXT NOT NULL,
    chat_enabled BOOLEAN NOT NULL DEFAULT false,
    url TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generated_links_expires_at ON generated_links (expires_at);
CREATE INDEX IF NOT EXISTS idx_generated_links_created_at ON generated_links (created_at);

-- Verify table structure
\d generated_links

EOF

echo "✅ Database schema fixed!"

# Test the database connection from the app container
echo "🧪 Testing database connection..."
docker exec virtual-audience-app-v2 node -e "
const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful:', result.rows[0]);
    
    // Test table exists
    const tableCheck = await client.query(\"SELECT to_regclass('generated_links') as table_exists\");
    console.log('✅ Generated links table exists:', tableCheck.rows[0].table_exists !== null);
    
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

test();
"

echo "🔄 Restarting application container to reload database connection..."
docker restart virtual-audience-app-v2

echo "⏳ Waiting for application to restart..."
sleep 10

echo "🧪 Testing link creation..."
curl -s -X POST http://localhost/api/links \
  -H "Content-Type: application/json" \
  -d '{"id":"docker-fix-test","streamName":"test","returnFeed":"studio1","chatEnabled":true,"url":"http://localhost/session?stream=test&return=studio1&chat=true","expiresAt":null}' \
  && echo "✅ Link creation successful!" \
  || echo "❌ Link creation still failing"

echo "📋 Checking current links..."
curl -s http://localhost/api/links | jq '.' || curl -s http://localhost/api/links

echo "✅ Database fix complete!"