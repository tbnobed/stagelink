#!/bin/bash

# Apply session token migration to existing Docker production database
echo "Applying session token migration to production database..."

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
    echo "✅ Session token migration completed successfully!"
    echo "Restarting application container to pick up schema changes..."
    docker-compose restart virtual-audience-app-v2
    echo "✅ Application container restarted"
    echo ""
    echo "The Virtual Audience Platform should now support session tokens properly."
    echo "You can test by creating a new streaming link."
else
    echo "❌ Migration failed. Please check the database logs:"
    echo "docker-compose logs virtual-audience-db-v2"
    exit 1
fi