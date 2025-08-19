#!/bin/bash

# Docker Installation Script for Ubuntu
set -e

echo "🐳 Installing Docker and Docker Compose on Ubuntu..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root. Run as a regular user with sudo privileges."
   exit 1
fi

# Update package index
echo "📦 Updating package index..."
sudo apt update

# Install required packages
echo "📦 Installing prerequisites..."
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common

# Add Docker's official GPG key
echo "🔑 Adding Docker GPG key..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "📝 Adding Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index again
echo "📦 Updating package index with Docker repository..."
sudo apt update

# Install Docker Engine
echo "🐳 Installing Docker Engine..."
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install Docker Compose (standalone)
echo "🔧 Installing Docker Compose..."
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add current user to docker group
echo "👤 Adding user to docker group..."
sudo usermod -aG docker $USER

# Start and enable Docker service
echo "🚀 Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

# Test Docker installation
echo "🧪 Testing Docker installation..."
if sudo docker run hello-world > /dev/null 2>&1; then
    echo "✅ Docker installed successfully!"
else
    echo "❌ Docker installation test failed"
    exit 1
fi

# Test Docker Compose
echo "🧪 Testing Docker Compose..."
if docker-compose --version > /dev/null 2>&1; then
    echo "✅ Docker Compose installed successfully!"
    docker-compose --version
else
    echo "❌ Docker Compose installation failed"
    exit 1
fi

echo ""
echo "🎉 Docker installation complete!"
echo ""
echo "⚠️  IMPORTANT: You need to log out and log back in (or run 'newgrp docker') for group changes to take effect."
echo ""
echo "Next steps:"
echo "1. Log out and log back in: exit"
echo "2. Or run: newgrp docker"
echo "3. Then run: ./deploy.sh"
echo ""
echo "Docker version:"
sudo docker --version
echo ""
echo "Docker Compose version:"
docker-compose --version