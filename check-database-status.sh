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
    
    # Check links and chat data
    echo ""
    echo "🔗 Checking link data..."
    LINK_COUNT=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM generated_links;" 2>/dev/null | tr -d ' ')
    SHORT_LINK_COUNT=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM short_links;" 2>/dev/null | tr -d ' ')
    VIEWER_LINK_COUNT=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM viewer_links;" 2>/dev/null | tr -d ' ')
    SHORT_VIEWER_LINK_COUNT=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM short_viewer_links;" 2>/dev/null | tr -d ' ')
    
    echo "   Guest streaming links: ${LINK_COUNT:-0}"
    echo "   Short guest links: ${SHORT_LINK_COUNT:-0}"
    echo "   Viewer-only links: ${VIEWER_LINK_COUNT:-0}"
    echo "   Short viewer links: ${SHORT_VIEWER_LINK_COUNT:-0}"
    
    # Check chat system
    echo ""
    echo "💬 Checking chat system..."
    CHAT_MESSAGES=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM chat_messages;" 2>/dev/null | tr -d ' ')
    CHAT_PARTICIPANTS=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM chat_participants;" 2>/dev/null | tr -d ' ')
    
    echo "   Total chat messages: ${CHAT_MESSAGES:-0}"
    echo "   Active participants: ${CHAT_PARTICIPANTS:-0}"
    
    # Check session tokens
    echo ""
    echo "🔐 Checking session tokens..."
    TOKEN_COUNT=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "SELECT COUNT(*) FROM session_tokens;" 2>/dev/null | tr -d ' ')
    echo "   Session tokens: ${TOKEN_COUNT:-0}"
    
else
    echo "❌ Database container is not running"
    echo "   Try: docker-compose up -d"
fi

echo ""
echo "📝 Database Schema Info:"
docker-compose exec db psql -U postgres -d virtual_audience -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "   ❌ Could not access database"

echo ""
echo "🔧 Virtual Audience Platform v2.0 Schema Verification:"
EXPECTED_TABLES="users generated_links short_links viewer_links short_viewer_links session_tokens chat_messages chat_participants session"
SCHEMA_CHECK=$(docker-compose exec db psql -U postgres -d virtual_audience -t -c "
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_name IN ('users','generated_links','short_links','viewer_links','short_viewer_links','session_tokens','chat_messages','chat_participants','session');
" 2>/dev/null | tr -d ' ')

if [ "$SCHEMA_CHECK" = "9" ]; then
    echo "   ✅ All v2.0 database tables present"
else
    echo "   ⚠️  Database schema incomplete ($SCHEMA_CHECK/9 tables found)"
    echo "   💡 Run migration: ./apply-session-token-migration.sh"
fi

echo ""
echo "💡 Available Actions:"
echo "   1. If admin user missing: Use restore-admin-user.sql"
echo "   2. If schema incomplete: Run ./apply-session-token-migration.sh"
echo "   3. For fresh start: docker-compose down -v && docker-compose up -d"
echo "   4. Check logs: docker-compose logs virtual-audience-app-v2"
echo "   5. Database shell: docker-compose exec db psql -U postgres -d virtual_audience"