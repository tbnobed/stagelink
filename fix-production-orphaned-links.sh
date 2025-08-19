#!/bin/bash

# Fix Orphaned Short Links in Production
# This script helps clean up orphaned short links from your production database

echo "🔧 Production Short Link Cleanup Tool"
echo "====================================="

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Please install PostgreSQL client tools."
    echo "On Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Prompt for database connection details
echo ""
echo "Please provide your production database connection details:"
echo "(You can find these in your production environment variables)"
echo ""

read -p "Database Host (e.g., your-db-host.com): " DB_HOST
read -p "Database Port (default: 5432): " DB_PORT
read -p "Database Name (default: virtual_audience): " DB_NAME
read -p "Database User (default: postgres): " DB_USER
read -s -p "Database Password: " DB_PASS
echo ""

# Set defaults
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-virtual_audience}  
DB_USER=${DB_USER:-postgres}

# Create connection string
DB_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo ""
echo "🔍 Checking for orphaned short links..."

# Check connection and find orphaned links
ORPHANED_LINKS=$(psql "$DB_URL" -t -c "
SELECT sl.id 
FROM short_links sl
LEFT JOIN generated_links gl ON (
    sl.stream_name = gl.stream_name AND 
    sl.return_feed = gl.return_feed AND 
    sl.chat_enabled = gl.chat_enabled
)
WHERE gl.id IS NULL;
" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Failed to connect to database. Please check your credentials."
    exit 1
fi

if [ -z "$ORPHANED_LINKS" ]; then
    echo "✅ No orphaned short links found!"
    exit 0
fi

echo "Found orphaned short links:"
echo "$ORPHANED_LINKS" | while read -r link; do
    if [ -n "$link" ]; then
        echo "  - $link"
    fi
done

echo ""
read -p "Delete these orphaned short links? (y/N): " confirm

if [[ $confirm =~ ^[Yy]$ ]]; then
    echo "🧹 Cleaning up orphaned short links..."
    
    # Delete orphaned short links
    psql "$DB_URL" -c "
    DELETE FROM short_links 
    WHERE id IN (
        SELECT sl.id
        FROM short_links sl
        LEFT JOIN generated_links gl ON (
            sl.stream_name = gl.stream_name AND 
            sl.return_feed = gl.return_feed AND 
            sl.chat_enabled = gl.chat_enabled
        )
        WHERE gl.id IS NULL
    );
    " >/dev/null

    if [ $? -eq 0 ]; then
        echo "✅ Orphaned short links cleaned up successfully!"
        
        # Show final counts
        echo ""
        echo "📊 Final database status:"
        psql "$DB_URL" -c "
        SELECT 
            (SELECT COUNT(*) FROM generated_links) as regular_links,
            (SELECT COUNT(*) FROM short_links) as short_links;
        "
    else
        echo "❌ Failed to clean up orphaned short links."
    fi
else
    echo "❌ Cleanup cancelled."
fi

echo ""
echo "💡 To prevent future orphaned links:"
echo "   1. Redeploy your application with the latest code"
echo "   2. The new version automatically cleans up short links when regular links are deleted"
echo "   3. Consider running this cleanup script periodically if needed"