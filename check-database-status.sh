#!/bin/bash

# Check Database Status and User Data
# This script helps diagnose what happened to your user data

echo "🔍 Virtual Audience Database Status Check"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Please run this script from your Virtual Audience project directory"
    exit 1
fi

echo "📊 Checking current database status..."
echo ""

# Get database status via Docker
if docker-compose ps | grep -q "virtual-audience-db"; then
    echo "✅ Database container is running"
    
    # Check user count
    echo "👥 Checking user accounts..."
    USER_COUNT=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
    
    if [ "$USER_COUNT" ]; then
        echo "   Total users in database: $USER_COUNT"
        
        if [ "$USER_COUNT" -gt 0 ]; then
            echo "   📋 Current users:"
            docker-compose exec db psql -U postgres -d virtual_audience -c "SELECT username, email, role, created_at FROM users ORDER BY created_at;"
        else
            echo "   ⚠️  No users found in database"
        fi
    else
        echo "   ❌ Could not query users table (may not exist)"
    fi
    
    # Check if admin exists
    echo ""
    echo "🔑 Checking for admin user..."
    ADMIN_EXISTS=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM users WHERE username='admin';" 2>/dev/null | tr -d ' ')
    
    if [ "$ADMIN_EXISTS" = "1" ]; then
        echo "   ✅ Admin user exists"
    else
        echo "   ❌ Admin user missing - you'll need to restore it"
        echo "   💡 Run: docker-compose exec db psql -U postgres -d virtual_audience -f /path/to/restore-admin-user.sql"
    fi
    
    # Check short links and regular links
    echo ""
    echo "🔗 Checking link data..."
    LINK_COUNT=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM generated_links;" 2>/dev/null | tr -d ' ')
    SHORT_LINK_COUNT=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM short_links;" 2>/dev/null | tr -d ' ')
    
    echo "   Regular links: ${LINK_COUNT:-0}"
    echo "   Short links: ${SHORT_LINK_COUNT:-0}"
    
else
    echo "❌ Database container is not running"
    echo "   Try: docker-compose up -d"
fi

echo ""
echo "📝 Database Schema Info:"
docker-compose exec db psql -U postgres -d virtual_audience -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "   ❌ Could not access database"

echo ""
echo "💡 Next Steps:"
echo "   1. If admin user is missing: Use restore-admin-user.sql"
echo "   2. If all users are gone: The Docker rebuild likely reset the database"
echo "   3. Future rebuilds will preserve data with the updated Docker script"
echo "   4. Consider backing up user data before major deployments"