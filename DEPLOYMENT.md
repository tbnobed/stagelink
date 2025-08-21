# Virtual Audience Platform - Docker Deployment Guide

This guide will help you deploy the Virtual Audience Platform v2.1 on your Ubuntu server using Docker.

## Latest Updates (August 2025)
- ✅ Fixed link sharing across browsers with server-side storage
- ✅ Added REST API for link management (/api/links)
- ✅ Improved Docker health checks and build process
- ✅ Enhanced production server with proper error handling
- ✅ Links now persist and sync across all users and browsers
- ✅ Fixed QR code generation with proper npm package integration
- ✅ Added production Docker compose configuration
- ✅ Enhanced deployment scripts with QR code support verification
- ✅ Complete authentication system with admin/user roles
- ✅ URL shortening system with secure 6-character codes
- ✅ Short links hide technical parameters from end users
- ✅ StageLinq branding integration
- ✅ SRS server environment configuration support
- ✅ **NEW**: Professional email invite system with SendGrid integration
- ✅ **NEW**: Clean short links in email invites (yourapp.com/s/ABC123)
- ✅ **NEW**: Optimized screen space utilization on Home and Generator pages
- ✅ **NEW**: Mobile-optimized responsive layouts with PWA support

## Prerequisites

- Ubuntu 20.04+ server
- Docker and Docker Compose installed
- At least 2GB RAM and 10GB disk space
- Open ports: 80 (HTTP), 5432 (PostgreSQL - optional)

## Quick Deployment

### For New Servers (Docker Not Installed):
1. **Install Docker:**
   ```bash
   chmod +x install-docker.sh && ./install-docker.sh
   ```

2. **Refresh user permissions:**
   ```bash
   # Log out and back in, OR run:
   newgrp docker
   ```

3. **Deploy the application:**
   ```bash
   ./deploy.sh
   ```

### For Servers with Docker:
1. **Run deployment:**
   ```bash
   chmod +x deploy.sh && ./deploy.sh
   ```

### For Custom Configuration (SRS Server + Email):
1. **Create/modify .env file:**
   ```bash
   # Copy example and customize
   cp .env.example .env
   # Edit .env to set your configuration:
   # SRS_HOST=your-srs-server.com
   # SRS_WHIP_PORT=1990
   # SRS_API_PORT=1985
   # SRS_USE_HTTPS=true
   # SENDGRID_API_KEY=your-sendgrid-api-key
   # SENDGRID_FROM_EMAIL=alerts@yourdomain.com
   ```

2. **Deploy with custom settings:**
   ```bash
   ./deploy.sh
   ```

4. **Access your application:**
   - HTTP: `http://your-server-ip`
   - SRS Config API: `http://your-server-ip/api/srs/config`

> **See QUICKSTART.md for simplified instructions**

## Email Invite System Setup

The platform now includes professional email invites powered by SendGrid:

### Features:
- **Clean Short Links**: Emails contain professional URLs like `yourapp.com/s/ABC123` instead of technical parameters
- **Email Validation**: Built-in email format validation and error handling
- **Professional Templates**: Clean, branded email templates for invitations
- **Integration**: Seamlessly integrated into both Home and Generator pages

### Setup Requirements:
1. **SendGrid Account**: Create account at [sendgrid.com](https://sendgrid.com)
2. **API Key**: Generate API key in SendGrid dashboard
3. **Verified Sender**: Configure verified sender email address
4. **Environment Variables**: Add to your `.env` file:
   ```bash
   SENDGRID_API_KEY=your-api-key-here
   SENDGRID_FROM_EMAIL=alerts@yourdomain.com
   ```

### Usage:
- Email invite buttons appear next to Copy Link and QR Code options
- Automatically generates short links for professional appearance
- Works for both guest session links and viewer links
- Validates email addresses before sending

## Manual Deployment Steps

### 1. Install Docker (if not installed)

```bash
# Update package index
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Environment Configuration

Create a `.env` file with your configuration:

```bash
# Database Configuration
POSTGRES_PASSWORD=your_secure_database_password
DATABASE_URL=postgresql://postgres:your_secure_database_password@db:5432/virtual_audience

# Security
SESSION_SECRET=your_very_secure_session_secret

# Application Configuration
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
```

### 3. SSL Certificates

For production, replace the self-signed certificates with valid ones:

```bash
# Place your certificates in the ssl/ directory
cp your-cert.pem ssl/cert.pem
cp your-private-key.pem ssl/key.pem

# Or use Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
```

### 4. Build and Deploy

```bash
# Build the application
docker-compose build

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

## File Structure

```
virtual-audience-platform/
├── docker-compose.yml      # Multi-service orchestration
├── Dockerfile             # Application container definition
├── init.sql              # Database initialization
├── deploy.sh             # Automated deployment script
├── .dockerignore         # Docker build exclusions
└── logs/                 # Application logs
```

## Services Overview

### 1. Application Container (app)
- **Port:** 80 (mapped from internal 5000)
- **Image:** Custom Node.js application
- **Health Check:** `/health` endpoint
- **Volumes:** `./logs:/app/logs`

### 2. PostgreSQL Database (db)
- **Port:** 5432
- **Image:** postgres:15-alpine
- **Volumes:** `postgres_data:/var/lib/postgresql/data`
- **Health Check:** `pg_isready`

## Management Commands

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f db

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Update and redeploy
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Database backup
docker-compose exec db pg_dump -U postgres virtual_audience > backup.sql

# Database restore
docker-compose exec -T db psql -U postgres virtual_audience < backup.sql
```

## Security Considerations

1. **Change Default Passwords:**
   - Update PostgreSQL password in `.env`
   - Change session secret in `.env`

2. **SSL Certificates:**
   - Replace self-signed certificates with valid ones
   - Set up auto-renewal for Let's Encrypt

3. **Firewall Configuration:**
   ```bash
   sudo ufw allow 22      # SSH
   sudo ufw allow 80      # HTTP
   sudo ufw enable
   ```

4. **Database Security:**
   - PostgreSQL is only accessible from within the Docker network
   - Use strong passwords
   - Regular backups

## Performance Tuning

### For High Traffic:

1. **Database Optimization:**
   - Increase PostgreSQL shared_buffers
   - Tune connection limits
   - Set up connection pooling

3. **Application Scaling:**
   - Use Docker Swarm or Kubernetes for horizontal scaling
   - Set up load balancing
   - Implement Redis for session storage

## Troubleshooting

### Common Issues:

1. **Port Already in Use:**
   ```bash
   sudo lsof -i :80
   sudo lsof -i :443
   # Kill conflicting processes or change ports
   ```

2. **Database Connection Issues:**
   ```bash
   docker-compose logs db
   docker-compose exec db psql -U postgres -d virtual_audience
   ```

3. **SSL Certificate Issues:**
   ```bash
   openssl x509 -in ssl/cert.pem -text -noout
   nginx -t  # Test nginx configuration
   ```

4. **Application Not Starting:**
   ```bash
   docker-compose logs app
   docker-compose exec app sh  # Debug container
   ```

### Health Checks:

```bash
# Application health
curl -f http://localhost/health

# Database health
docker-compose exec db pg_isready -U postgres
```

## Monitoring

Set up monitoring with tools like:
- **Logs:** Centralized logging with ELK stack
- **Metrics:** Prometheus + Grafana
- **Uptime:** UptimeRobot or similar
- **Alerts:** Set up email/SMS notifications

## Backup Strategy

1. **Database Backups:**
   ```bash
   # Daily backup script
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   docker-compose exec db pg_dump -U postgres virtual_audience > "backup_${DATE}.sql"
   
   # Keep only last 7 days
   find . -name "backup_*.sql" -mtime +7 -delete
   ```

2. **Application Data:**
   - Back up uploaded files and logs
   - Store SSL certificates securely

## Updates and Maintenance

1. **Regular Updates:**
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade
   
   # Update Docker images
   docker-compose pull
   docker-compose up -d
   ```

2. **Application Updates:**
   ```bash
   git pull origin main
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Support

For issues and questions:
1. Check the application logs: `docker-compose logs app`
2. Verify all services are running: `docker-compose ps`
3. Test individual components using the troubleshooting commands above

Remember to always test deployments in a staging environment before applying to production!