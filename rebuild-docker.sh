#!/bin/bash

# Virtual Audience Platform v2.0 - Docker Rebuild Script
# This script rebuilds the Docker containers with the latest fixes for guest user chat

echo "🔄 Rebuilding Virtual Audience Platform v2.0 with latest guest user fixes..."

# Stop existing containers
echo "⏹️  Stopping existing containers..."
docker-compose down

# Remove old containers and images to force rebuild
echo "🗑️  Removing old containers and images..."
docker-compose rm -f
docker rmi virtual-audience-app-v2 2>/dev/null || echo "App image not found (OK)"
docker rmi virtual-audience-db-v2 2>/dev/null || echo "DB image not found (OK)"

# Clear Docker build cache for our images
docker builder prune -f

# Rebuild and start with fresh images
echo "🏗️  Rebuilding containers with latest fixes..."
docker-compose build --no-cache

echo "🚀 Starting updated Virtual Audience Platform v2.0..."
docker-compose up -d

echo "✅ Docker rebuild complete!"
echo "🌐 Application should be available at: http://localhost:5000"
echo "🔍 Check logs with: docker-compose logs -f app"
echo ""
echo "🎯 Fixes included in this rebuild:"
echo "   ✓ Guest users now use null user_id instead of 999999"
echo "   ✓ Fixed foreign key constraint violations"
echo "   ✓ Chat system works for both authenticated and guest users"
echo "   ✓ Proper database schema with nullable user_id column"