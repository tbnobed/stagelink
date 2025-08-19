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

# Build authentication modules separately to ensure they're available
RUN npx esbuild server/setup-admin.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/setup-admin.js
RUN npx esbuild server/auth.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/auth.js

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

# Create startup script before switching to nodejs user
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
echo "Waiting for database..."
sleep 10
echo "Creating database schema with authentication support..."
export DATABASE_URL="postgresql://postgres:postgres@db:5432/virtual_audience"
export SESSION_SECRET="${SESSION_SECRET:-virtual-audience-production-secret-change-in-production}"

# For clean deployments, drop and recreate schema
psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" 2>/dev/null || echo "Schema recreation skipped"

# Push schema with force flag
echo "yes" | npx drizzle-kit push --force 2>&1 || echo "Schema push completed"
echo "Starting Virtual Audience Platform with authentication..."
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