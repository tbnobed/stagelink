# Virtual Audience Platform - Quick Start Guide

## For New Ubuntu Servers (Docker Not Installed)

Follow these simple steps to get your Virtual Audience Platform running:

### Step 1: Install Docker
```bash
# Make the Docker installation script executable and run it
chmod +x install-docker.sh && ./install-docker.sh
```

### Step 2: Restart Your Session
After Docker installation, you need to refresh your user permissions:
```bash
# Option 1: Log out and log back in
exit
# Then SSH back into your server

# Option 2: Or use this command without logging out
newgrp docker
```

### Step 3: Deploy the Application
```bash
# Run the deployment script
./deploy.sh
```

That's it! Your application will be available at:
- **HTTP**: `http://your-server-ip`
- **HTTPS**: `https://your-server-ip` (with self-signed certificate)

---

## For Servers with Docker Already Installed

If Docker is already installed on your server:

```bash
# Just run the deployment script
chmod +x deploy.sh && ./deploy.sh
```

---

## What Gets Installed

- **Docker Engine**: Container runtime
- **Docker Compose**: Multi-container orchestration
- **Virtual Audience Platform**: Your streaming application
- **PostgreSQL Database**: For data persistence
- **Nginx Reverse Proxy**: For SSL and load balancing

---

## Quick Commands

```bash
# View application logs
docker-compose logs -f app

# View all service status
docker-compose ps

# Stop all services
docker-compose down

# Restart services
docker-compose restart

# Update application
git pull && docker-compose down && docker-compose build --no-cache && docker-compose up -d
```

---

## Troubleshooting

### If deployment fails:
1. Check Docker is running: `sudo systemctl status docker`
2. Verify user permissions: `groups $USER` (should include "docker")
3. Check logs: `docker-compose logs`

### If you can't access the application:
1. Check firewall: `sudo ufw status`
2. Open ports: `sudo ufw allow 80 && sudo ufw allow 443`
3. Verify services: `docker-compose ps`

### Need help?
Check the detailed `DEPLOYMENT.md` guide for comprehensive troubleshooting and configuration options.

---

## Security Notes

- The deployment creates self-signed SSL certificates
- Default passwords are randomly generated
- For production use, replace with valid SSL certificates
- Update passwords in the `.env` file for enhanced security

Your Virtual Audience Platform is now ready for live streaming!