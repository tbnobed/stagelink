# Virtual Audience Platform v2.6 - Production Docker Build
# Includes: Productions & Capacity, Email Campaigns, Return Feeds (configurable),
#           WHEP Server Pool, Multi-server WHIP load balancing,
#           TBN Adult Likeness Authorization, US broadcast compliance
FROM node:18-alpine AS builder

ARG CACHE_BUST
RUN echo "Cache bust: $CACHE_BUST"

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN rm -rf dist/ node_modules/.cache/ .vite/ 2>/dev/null || true
RUN npx vite build && npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --allow-overwrite

# Production stage
FROM node:18-alpine AS production

# Install PostgreSQL client and dumb-init
RUN apk add --no-cache dumb-init postgresql-client

WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared

# Copy the single-source-of-truth upgrade script into the image.
# start.sh runs this on every container start so fresh deploys AND
# upgrades from any prior version are handled automatically.
COPY --chown=nodejs:nodejs fix-production-database.sql /app/fix-production-database.sql

# Startup script — runs the upgrade SQL then launches the app
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
set -e
echo "=== Virtual Audience Platform v2.6 ==="
echo "Waiting for database to be ready..."
sleep 5

echo "Running database migrations (fix-production-database.sql)..."
psql "$DATABASE_URL" -f /app/fix-production-database.sql
echo "Database schema is up to date."

echo "Starting application server..."
exec node dist/production.js
EOF

RUN chmod +x /app/start.sh && chown nodejs:nodejs /app/start.sh

USER nodejs
EXPOSE 5000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/app/start.sh"]
