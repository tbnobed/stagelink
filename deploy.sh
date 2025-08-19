#!/bin/bash

# Virtual Audience Platform Deployment Script
set -e

echo "🚀 Starting Virtual Audience Platform deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo ""
    echo "Would you like to install Docker automatically? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "🔧 Running Docker installation script..."
        chmod +x install-docker.sh
        ./install-docker.sh
        echo ""
        echo "⚠️  Please log out and log back in, then run ./deploy.sh again"
        echo "Or run: newgrp docker && ./deploy.sh"
        exit 0
    else
        echo "Please install Docker manually and run this script again."
        echo "Installation script available: ./install-docker.sh"
        exit 1
    fi
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please run the Docker installation script:"
    echo "./install-docker.sh"
    exit 1
fi

# Check if user is in docker group
if ! groups $USER | grep &>/dev/null '\bdocker\b'; then
    echo "⚠️  User $USER is not in the docker group."
    echo "Run: sudo usermod -aG docker $USER && newgrp docker"
    echo "Then run this script again."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs

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
if curl -f http://localhost/health &> /dev/null; then
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
echo "   HTTP:  http://$(hostname -I | awk '{print $1}')"
echo ""
echo "📝 Useful commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart"
echo "   Update:       ./deploy.sh"
echo ""
echo "⚠️  Production checklist:"
echo "   1. Update default passwords in .env file"
echo "   2. Configure your domain name in nginx.conf"
echo "   3. Set up proper firewall rules"
echo "   4. Consider adding SSL/HTTPS for production use"