#!/bin/bash

# Virtual Audience Platform Deployment Script
set -e

echo "🚀 Starting Virtual Audience Platform deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs ssl

# Check if SSL certificates exist
if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
    echo "🔐 SSL certificates not found. Generating self-signed certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    echo "✅ Self-signed certificates generated. For production, replace with valid certificates."
fi

# Check for environment file
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cat > .env << EOF
# Database Configuration
POSTGRES_PASSWORD=$(openssl rand -base64 32)
DATABASE_URL=postgresql://postgres:\${POSTGRES_PASSWORD}@db:5432/virtual_audience

# Security
SESSION_SECRET=$(openssl rand -base64 32)

# Application Configuration
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
EOF
    echo "✅ .env file created with random passwords."
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
if docker-compose exec app curl -f http://localhost:5000/health &> /dev/null; then
    echo "✅ Application is healthy!"
else
    echo "⚠️  Application health check failed. Checking logs..."
    docker-compose logs app
fi

# Show deployment status
echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Access your application at:"
echo "   HTTP:  http://localhost"
echo "   HTTPS: https://localhost"
echo ""
echo "📝 Useful commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart"
echo "   Update:       ./deploy.sh"
echo ""
echo "⚠️  Remember to:"
echo "   1. Replace self-signed SSL certificates with valid ones for production"
echo "   2. Update default passwords in .env file"
echo "   3. Configure your domain name in nginx.conf"
echo "   4. Set up proper firewall rules"