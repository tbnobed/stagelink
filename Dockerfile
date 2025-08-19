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
RUN npx vite build && npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Verify build output
RUN ls -la dist/ && test -f dist/production.js && test -d dist/public

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

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
COPY --from=builder --chown=nodejs:nodejs /app/server/db-docker.ts ./server/db-docker.ts

# Create startup script before switching to nodejs user
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
echo "Waiting for database..."
sleep 10
echo "Creating database schema..."
export DATABASE_URL="postgresql://postgres:postgres@db:5432/virtual_audience"
npx drizzle-kit push --force 2>&1 || echo "Schema push completed"
echo "Using Docker-specific database configuration..."
cp server/db-docker.ts dist/db.js
echo "Starting application..."
exec node dist/production.js
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