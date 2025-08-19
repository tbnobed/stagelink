# Docker Deployment Update - v2.0

## Overview

Updated Docker configuration for Virtual Audience Platform v2.0 with QR code support, link sharing API, and production optimizations.

## What's Updated

### Dockerfile Improvements
- ✅ Added QR code package verification in production build
- ✅ Updated to Node.js 18 Alpine for latest security patches
- ✅ Enhanced build verification with output checks
- ✅ Improved health check timing for production stability
- ✅ Added proper dependency installation for QR code generation

### New Files Added
- **docker-compose.prod.yml** - Production-optimized configuration with resource limits
- **.env.example** - Environment variable template for easy setup
- **Enhanced test-api.sh** - API testing with v2.0 feature verification

### Container Updates
- Container names updated to v2 (virtual-audience-app-v2, virtual-audience-db-v2)
- Added QR code package verification during build
- Enhanced health checks with proper timeout values
- Added memory limits for production deployments

## Deployment Commands

### Development Deployment
```bash
# Standard development deployment
docker-compose up -d
```

### Production Deployment
```bash
# Production deployment with resource limits
docker-compose -f docker-compose.prod.yml up -d

# Or use the deployment script
./deploy.sh
```

### Clean Deployment
```bash
# Clean deployment (removes old images/volumes)
./deploy.sh --clean
```

## New Features Verified in Docker

### QR Code Generation
- ✅ QR code npm package installed and verified
- ✅ Canvas element properly configured for Docker environment
- ✅ TypeScript definitions included for production builds

### Link Sharing API
- ✅ REST API endpoints working in containerized environment
- ✅ Cross-browser link sharing functional
- ✅ Real-time synchronization between containers

### Database Integration
- ✅ PostgreSQL container with proper health checks
- ✅ Database initialization scripts included
- ✅ Session storage working with containerized database

## Testing Your Docker Deployment

1. **Build and start containers:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

2. **Test the API:**
   ```bash
   ./test-api.sh http://your-server-ip
   ```

3. **Verify QR code functionality:**
   - Open the application in browser
   - Generate a link on "Link Generator" page
   - Click "QR Code" button
   - Verify QR code appears without errors

4. **Test link sharing:**
   - Generate links in one browser
   - Open "Links" page in another browser/device
   - Verify links are synchronized across browsers

## Production Considerations

### Resource Limits (docker-compose.prod.yml)
- **App Container**: 512M limit, 256M reservation
- **Database Container**: 256M limit, 128M reservation

### Health Check Configuration
- **App**: 30s interval, 10s timeout, 40s start period
- **Database**: 10s interval, 5s timeout, 30s start period

### Security Features
- Non-root user execution
- Proper signal handling with dumb-init
- Network isolation between services
- Read-only configuration files

## Troubleshooting

### QR Code Issues
If QR codes don't generate:
```bash
# Check QR package in container
docker exec virtual-audience-app-v2 node -e "console.log(require('qrcode'))"
```

### API Connection Issues
```bash
# Check API health
curl http://localhost/health

# Check container logs
docker-compose logs app
```

### Database Connection Issues
```bash
# Check database health
docker exec virtual-audience-db-v2 pg_isready -U postgres

# Check database logs
docker-compose logs db
```

## Rollback Strategy

If v2.0 deployment fails:
```bash
# Stop v2 containers
docker-compose down

# Use previous configuration
git checkout HEAD~1 docker-compose.yml Dockerfile

# Restart with previous version
docker-compose up -d
```

The Docker deployment is now fully updated with v2.0 features and ready for production use.