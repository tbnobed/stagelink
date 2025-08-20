#!/bin/bash

# Apply Virtual Audience Platform v2.0 migration to existing Docker production database
echo "Applying Virtual Audience Platform v2.0 migration (includes session tokens, chat system, and schema updates)..."

# Check if Docker containers are running
if ! docker-compose ps | grep -q "virtual-audience-db-v2.*Up"; then
    echo "Error: Database container is not running. Please start with 'docker-compose up -d'"
    exit 1
fi

# Copy migration script to database container and execute
echo "Copying migration script to database container..."
docker cp migrate-session-tokens.sql virtual-audience-db-v2:/tmp/migrate-session-tokens.sql

echo "Executing migration script..."
docker exec virtual-audience-db-v2 psql -U postgres -d virtual_audience -f /tmp/migrate-session-tokens.sql

if [ $? -eq 0 ]; then
    echo "✅ Virtual Audience Platform v2.0 migration completed successfully!"
    echo "   - Session token security system ✅"
    echo "   - Chat system with messages and participants ✅"
    echo "   - Updated database schema with proper types and indexes ✅"
    echo ""
    echo "Restarting application container to pick up schema changes..."
    docker-compose restart virtual-audience-app-v2
    echo "✅ Application container restarted"
    echo ""
    echo "The Virtual Audience Platform v2.0 is now ready with full feature support:"
    echo "   - User authentication with roles (admin, engineer, user)"
    echo "   - Streaming link generation with expiration management"
    echo "   - Session token security for single-use links"
    echo "   - Integrated chat system for guest communication"
    echo "   - Viewer-only links for studio return feed monitoring"
    echo "   - URL shortening functionality"
    echo ""
    echo "You can now test all features through the web interface."
else
    echo "❌ Migration failed. Please check the database logs:"
    echo "docker-compose logs virtual-audience-db-v2"
    exit 1
fi