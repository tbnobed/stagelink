# Docker Session Token Migration Fix

## Problem
The Docker production database already existed before session token support was added, so the `init.sql` file wasn't executed. The application is failing with:

- `relation "session_tokens" does not exist`
- `column "session_token" does not exist`

## Solution

Run the migration script to add missing tables and columns to the existing database:

```bash
# Make sure you're in the project directory with docker-compose.yml
# Apply the migration
./apply-session-token-migration.sh
```

## What the migration does:

1. **Creates `session_tokens` table** - For secure token management
2. **Adds `session_token` column to `links` table** - Links regular streaming sessions to tokens
3. **Adds `session_token` column to `viewer_links` table** - Links viewer sessions to tokens  
4. **Adds `session_token` column to `short_links` table** - Links short URLs to tokens
5. **Recreates `short_viewer_links` table** - Fixes structure with proper foreign keys
6. **Creates performance indexes** - For fast token lookups
7. **Restarts application container** - Picks up new schema

## Manual execution (if script fails):

```bash
# Copy migration file to database container
docker cp migrate-session-tokens.sql virtual-audience-db-v2:/tmp/migrate-session-tokens.sql

# Execute migration
docker exec virtual-audience-db-v2 psql -U postgres -d virtual_audience -f /tmp/migrate-session-tokens.sql

# Restart application
docker-compose restart virtual-audience-app-v2
```

## Verification:

After running the migration, test by:
1. Creating a new streaming link
2. Checking that no database errors appear in logs
3. Accessing the generated short link successfully

The platform should now fully support session tokens and URL shortening in Docker production.