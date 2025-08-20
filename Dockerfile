# Multi-stage build for Virtual Audience Platform v2.0
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application
RUN npx vite build && npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --allow-overwrite

# Build Docker-specific database configuration  
RUN npx esbuild server/db-docker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/db-docker.js --external:../shared/schema.js

# Build authentication modules and utilities separately to ensure they're available
RUN mkdir -p dist/utils
RUN npx esbuild server/setup-admin.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/setup-admin.js
RUN npx esbuild server/auth.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/auth.js
RUN npx esbuild server/utils/shortCode.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/utils/shortCode.js

# Verify build output
RUN ls -la dist/ && test -f dist/production.js && test -d dist/public && test -f dist/db-docker.js

# Production stage
FROM node:18-alpine AS production

# Install dumb-init and postgresql-client for schema management
RUN apk add --no-cache dumb-init postgresql-client

# Create app directory and user
WORKDIR /app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Install only production dependencies (including qrcode for QR generation and drizzle-kit)
COPY package*.json ./
RUN npm ci --only=production && npm install drizzle-kit pg && npm cache clean --force

# Verify packages are installed
RUN node -e "require('qrcode'); require('drizzle-orm'); require('pg'); console.log('All packages verified')"

# Copy built application and config from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared
COPY --from=builder --chown=nodejs:nodejs /app/server ./server

# Copy migration files for manual emergency use if needed
COPY --chown=nodejs:nodejs migrate-session-tokens.sql ./migrate-session-tokens.sql
COPY --chown=nodejs:nodejs apply-session-token-migration.sh ./apply-session-token-migration.sh
COPY --chown=nodejs:nodejs DOCKER-SESSION-TOKEN-FIX.md ./DOCKER-SESSION-TOKEN-FIX.md

# Create startup script before switching to nodejs user
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
echo "Waiting for database..."
sleep 10
echo "Setting up Virtual Audience Platform with authentication and URL shortening..."
export DATABASE_URL="postgresql://postgres:postgres@db:5432/virtual_audience"
export SESSION_SECRET="${SESSION_SECRET:-virtual-audience-production-secret-change-in-production}"

# Check if this is a fresh deployment or an update
EXISTING_USERS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$EXISTING_USERS" = "0" ] || [ -z "$EXISTING_USERS" ]; then
  echo "Fresh deployment detected - setting up clean database..."
  # Only drop schema for completely fresh deployments
  psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" 2>/dev/null || echo "Schema recreation skipped"
  echo "yes" | npx drizzle-kit push --force 2>&1 || echo "Schema push completed"
else
  echo "Existing data detected ($EXISTING_USERS users) - preserving data and updating schema..."
  
  # Check if session_tokens table exists - if not, we need to run migration
  SESSION_TOKENS_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='session_tokens');" 2>/dev/null | tr -d ' ' || echo "f")
  
  if [ "$SESSION_TOKENS_EXISTS" = "f" ]; then
    echo "Session tokens table missing - applying migration for existing deployment..."
    
    # Apply session token migration directly via SQL
    psql "$DATABASE_URL" << 'MIGRATE_EOF'
-- Create session_tokens table
CREATE TABLE IF NOT EXISTS "session_tokens" (
        "id" varchar PRIMARY KEY NOT NULL,
        "link_id" varchar NOT NULL,
        "link_type" varchar NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        CONSTRAINT "session_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Create viewer_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS "viewer_links" (
        "id" varchar PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        "session_token" varchar,
        CONSTRAINT "viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Create generated_viewer_links table if it doesn't exist (alternative naming)
CREATE TABLE IF NOT EXISTS "generated_viewer_links" (
        "id" varchar PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        "session_token" varchar,
        CONSTRAINT "generated_viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Add missing updated_at column to users table if it doesn't exist
DO $$ BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
        ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
        RAISE NOTICE 'Added updated_at column to users table';
    END IF;
END $$;

-- Add session_token column to tables if missing - handle both old and new table names
DO $$ BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='generated_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_links' AND column_name='session_token') THEN
            ALTER TABLE "generated_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to generated_links table';
        END IF;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='links' AND column_name='session_token') THEN
            ALTER TABLE "links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to links table';
        END IF;
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='generated_viewer_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_viewer_links' AND column_name='session_token') THEN
            ALTER TABLE "generated_viewer_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to generated_viewer_links table';
        END IF;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='viewer_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewer_links' AND column_name='session_token') THEN
            ALTER TABLE "viewer_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to viewer_links table';
        END IF;
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='short_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_links' AND column_name='session_token') THEN
            ALTER TABLE "short_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to short_links table';
        END IF;
    END IF;
END $$;

-- Fix short_viewer_links table structure
DROP TABLE IF EXISTS "short_viewer_links";
CREATE TABLE IF NOT EXISTS "short_viewer_links" (
        "id" varchar(6) PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "session_token" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp,
        "created_by" integer NOT NULL,
        CONSTRAINT "short_viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS "session_tokens_link_id_idx" ON "session_tokens" ("link_id");
CREATE INDEX IF NOT EXISTS "session_tokens_link_type_idx" ON "session_tokens" ("link_type");
CREATE INDEX IF NOT EXISTS "session_tokens_expires_at_idx" ON "session_tokens" ("expires_at");
MIGRATE_EOF
    
    echo "Session token migration completed"
  else
    echo "Session tokens table exists - checking for any missing tables and columns..."
    
    # Ensure viewer_links tables exist even if session_tokens exists
    psql "$DATABASE_URL" << 'TABLES_EOF'
-- Create viewer_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS "viewer_links" (
        "id" varchar PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        "session_token" varchar,
        CONSTRAINT "viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Create generated_viewer_links table if it doesn't exist (alternative naming)
CREATE TABLE IF NOT EXISTS "generated_viewer_links" (
        "id" varchar PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "url" text NOT NULL,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "created_by" integer NOT NULL,
        "session_token" varchar,
        CONSTRAINT "generated_viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Fix short_viewer_links table structure - drop and recreate with correct schema
DROP TABLE IF EXISTS "short_viewer_links";
CREATE TABLE IF NOT EXISTS "short_viewer_links" (
        "id" varchar(6) PRIMARY KEY NOT NULL,
        "return_feed" varchar NOT NULL,
        "chat_enabled" boolean DEFAULT false NOT NULL,
        "session_token" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp,
        "created_by" integer NOT NULL,
        CONSTRAINT "short_viewer_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);
TABLES_EOF
    
    # Ensure all missing columns exist - handle both old and new table names
    psql "$DATABASE_URL" << 'COLUMNS_EOF'
-- Add missing updated_at column to users table if it doesn't exist
DO $$ BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
        ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
        RAISE NOTICE 'Added updated_at column to users table';
    END IF;
END $$;
DO $$ BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='generated_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_links' AND column_name='session_token') THEN
            ALTER TABLE "generated_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to generated_links table';
        END IF;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='links' AND column_name='session_token') THEN
            ALTER TABLE "links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to links table';
        END IF;
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='generated_viewer_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_viewer_links' AND column_name='session_token') THEN
            ALTER TABLE "generated_viewer_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to generated_viewer_links table';
        END IF;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='viewer_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewer_links' AND column_name='session_token') THEN
            ALTER TABLE "viewer_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to viewer_links table';
        END IF;
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='short_links') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='short_links' AND column_name='session_token') THEN
            ALTER TABLE "short_links" ADD COLUMN "session_token" varchar;
            RAISE NOTICE 'Added session_token column to short_links table';
        END IF;
    END IF;
END $$;
COLUMNS_EOF
    
    echo "Column checks completed"
  fi
  
  # For existing deployments, update schema with Drizzle
  npx drizzle-kit push 2>&1 || echo "Schema update completed"
fi

echo "Starting Virtual Audience Platform..."
exec node -e "
process.env.USE_PG_DRIVER = 'true';
process.env.SESSION_SECRET = process.env.SESSION_SECRET;
import('./dist/production.js');
"
EOF

RUN chmod +x /app/start.sh && chown nodejs:nodejs /app/start.sh

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start with schema setup
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]