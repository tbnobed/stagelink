# Docker Deployment Troubleshooting

## Common Issues and Solutions

### Issue: "Failed to create link" errors (500 status)

**Symptoms:**
- Application starts successfully
- Database connects properly
- POST /api/links returns 500 error
- Logs show "Failed to create link"

**Cause:**
Schema mismatch between init.sql tables and Drizzle schema expectations.

**Solution:**
```bash
# Run the database fix script
./fix-docker-database.sh
```

**Manual Fix:**
```bash
# Connect to database container
docker exec -it virtual-audience-db-v2 psql -U postgres -d virtual_audience

# Drop conflicting table
DROP TABLE IF EXISTS streaming_links;

# Create correct table
CREATE TABLE generated_links (
    id TEXT PRIMARY KEY,
    stream_name TEXT NOT NULL,
    return_feed TEXT NOT NULL,
    chat_enabled BOOLEAN NOT NULL DEFAULT false,
    url TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP
);

# Exit and restart app
\q
docker restart virtual-audience-app-v2
```

### Issue: Database connection errors

**Check database status:**
```bash
docker exec virtual-audience-db-v2 pg_isready -U postgres
```

**Check environment variables:**
```bash
docker exec virtual-audience-app-v2 env | grep -E "(DATABASE_URL|PG)"
```

**Reset database:**
```bash
docker-compose down
docker volume rm stagelink_postgres_data
docker-compose up -d
```

### Issue: "version is obsolete" warnings

**Solution:**
Remove the `version: '3.8'` line from docker-compose.yml files.

```bash
# Edit docker-compose.yml and remove:
# version: '3.8'
```

### Issue: Links disappear after restart

**Verify database storage:**
```bash
# Check if using DatabaseStorage
docker exec virtual-audience-app-v2 grep -r "DatabaseStorage" ./dist/

# Test link persistence
curl -X POST http://localhost/api/links -H "Content-Type: application/json" -d '{"id":"test","streamName":"test","returnFeed":"studio1","chatEnabled":true,"url":"http://localhost/test","expiresAt":null}'
docker restart virtual-audience-app-v2
sleep 10
curl http://localhost/api/links
```

### Issue: Build failures

**Clear cache and rebuild:**
```bash
docker-compose down
docker system prune -f
docker-compose build --no-cache
docker-compose up -d
```

### Issue: Port conflicts

**Check if port 80 is in use:**
```bash
sudo netstat -tulpn | grep :80
```

**Use different port:**
```bash
# Edit docker-compose.yml
ports:
  - "8080:5000"  # Instead of "80:5000"
```

## Useful Commands

### Viewing Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f db
```

### Database Management
```bash
# Connect to database
docker exec -it virtual-audience-db-v2 psql -U postgres -d virtual_audience

# Show all tables
\dt

# Show table structure
\d generated_links

# Show all links
SELECT * FROM generated_links;
```

### Container Management
```bash
# Check container status
docker-compose ps

# Restart specific service
docker-compose restart app

# Rebuild and restart
docker-compose up -d --build

# Stop all services
docker-compose down
```

### Testing API Endpoints
```bash
# Health check
curl http://localhost/health

# List links
curl http://localhost/api/links

# Create test link
curl -X POST http://localhost/api/links \
  -H "Content-Type: application/json" \
  -d '{"id":"test-123","streamName":"test","returnFeed":"studio1","chatEnabled":true,"url":"http://localhost/session?stream=test","expiresAt":null}'

# Delete test link
curl -X DELETE http://localhost/api/links/test-123
```

## Emergency Recovery

If the deployment is completely broken:

```bash
# Nuclear option - complete reset
docker-compose down
docker system prune -a -f
docker volume prune -f

# Redeploy from scratch
./deploy.sh --clean
```

Remember to backup your data before running destructive commands!