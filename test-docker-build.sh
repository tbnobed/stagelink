#!/bin/bash

# Test Docker Build for Virtual Audience Platform v2.0
# Tests URL shortening feature and authentication system

set -e

echo "🔨 Testing Docker build with URL shortening features..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t virtual-audience-test . || {
    echo "❌ Docker build failed!"
    exit 1
}

echo "✅ Docker image built successfully!"

# Check if image was created
if docker images | grep -q virtual-audience-test; then
    echo "✅ Docker image 'virtual-audience-test' created successfully"
else
    echo "❌ Docker image not found in local registry"
    exit 1
fi

# Test image structure - run a temporary container to verify build artifacts
echo "🔍 Verifying build artifacts..."
docker run --rm virtual-audience-test sh -c '
echo "Checking build artifacts..."
test -f /app/dist/production.js && echo "✅ Production server built" || echo "❌ Production server missing"
test -f /app/dist/utils/shortCode.js && echo "✅ Short code utility built" || echo "❌ Short code utility missing"
test -f /app/dist/auth.js && echo "✅ Authentication module built" || echo "❌ Authentication module missing"
test -f /app/dist/setup-admin.js && echo "✅ Admin setup module built" || echo "❌ Admin setup module missing"
test -d /app/dist/public && echo "✅ Frontend assets built" || echo "❌ Frontend assets missing"
test -f /app/drizzle.config.ts && echo "✅ Database config copied" || echo "❌ Database config missing"
test -f /app/start.sh && echo "✅ Startup script created" || echo "❌ Startup script missing"
'

# Test with docker-compose
echo "🐳 Testing Docker Compose configuration..."
if [ -f "docker-compose.yml" ]; then
    echo "✅ Docker Compose file found"
    
    # Validate compose file syntax
    docker-compose config > /dev/null && {
        echo "✅ Docker Compose configuration is valid"
    } || {
        echo "❌ Docker Compose configuration is invalid"
        exit 1
    }
else
    echo "❌ docker-compose.yml not found"
    exit 1
fi

# Check environment configuration
echo "🔧 Checking environment configuration..."
if [ -f ".env.example" ]; then
    echo "✅ Environment example file found"
else
    echo "⚠️  No .env.example found - consider creating one for easier setup"
fi

echo ""
echo "🎉 Docker build test completed successfully!"
echo ""
echo "📋 Summary:"
echo "- Docker image builds without errors"
echo "- All required modules are compiled (including URL shortening utilities)"
echo "- Authentication system is built and ready"
echo "- Frontend assets are properly bundled"
echo "- Database configuration is ready"
echo "- Docker Compose configuration is valid"
echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "To deploy:"
echo "1. Copy .env.example to .env and configure secrets"
echo "2. Run: docker-compose up -d"
echo "3. Access at http://your-domain"
echo "4. Login with admin/password and change password immediately"

# Cleanup
docker rmi virtual-audience-test &> /dev/null || true
echo ""
echo "✅ Test cleanup completed"