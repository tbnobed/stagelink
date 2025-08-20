#!/bin/bash

# Fix Production Docker Database - Virtual Audience Platform v2.0
echo "🔧 Fixing production Docker database schema..."

# Check if Docker containers are running
if ! docker ps | grep -q "virtual-audience-db"; then
    echo "❌ Database container is not running. Please start with 'docker-compose up -d'"
    exit 1
fi

# Copy the fix script to the database container
echo "📋 Copying database fix script to container..."
docker cp fix-production-database.sql virtual-audience-db-v2:/tmp/fix-production-database.sql

# Execute the fix script
echo "🚀 Executing production database fix..."
docker exec virtual-audience-db-v2 psql -U postgres -d virtual_audience -f /tmp/fix-production-database.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Production database fix completed successfully!"
    echo "   - Session table for authentication ✅"
    echo "   - Chat system tables and enums ✅"
    echo "   - Session tokens security system ✅"
    echo "   - All missing indexes created ✅"
    echo ""
    echo "🔄 Restarting application container..."
    docker-compose restart virtual-audience-app-v2
    echo "✅ Application container restarted"
    echo ""
    echo "🎉 Your production deployment should now work properly!"
    echo "   The Virtual Audience Platform v2.0 is ready with all features."
else
    echo "❌ Production database fix failed. Check logs:"
    echo "docker-compose logs virtual-audience-db-v2"
    exit 1
fi