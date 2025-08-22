# Separate WHIP/WHEP Server Configuration

The Virtual Audience Platform now supports configuring separate server addresses for WHIP (publishing) and WHEP (viewing) operations. This allows for more flexible deployment scenarios where you may want to distribute load or use different servers for publishing vs viewing.

## New Environment Variables

### WHIP Server (Publishing)
```bash
SRS_WHIP_HOST=publisher.example.com
SRS_WHIP_PORT=1990
SRS_WHIP_USE_HTTPS=true
```

### WHEP Server (Viewing)
```bash
SRS_WHEP_HOST=viewer.example.com
SRS_WHEP_PORT=8080
SRS_WHEP_USE_HTTPS=true
```

### API Server (Statistics)
```bash
SRS_API_HOST=api.example.com
SRS_API_PORT=1985
SRS_API_USE_HTTPS=false
```

## Backward Compatibility

The system maintains full backward compatibility with existing configurations. If the new separate server variables are not set, the system will fall back to the legacy configuration:

```bash
SRS_HOST=cdn2.obedtv.live
SRS_USE_HTTPS=true
SRS_WHIP_PORT=1990
SRS_API_PORT=1985
```

## Configuration Examples

### Example 1: Same Server, Different Ports
```bash
# All services on same host with different ports
SRS_WHIP_HOST=srs.example.com
SRS_WHIP_PORT=1990
SRS_WHIP_USE_HTTPS=true

SRS_WHEP_HOST=srs.example.com
SRS_WHEP_PORT=8080
SRS_WHEP_USE_HTTPS=true

SRS_API_HOST=srs.example.com
SRS_API_PORT=1985
SRS_API_USE_HTTPS=false
```

### Example 2: Completely Separate Servers
```bash
# Different servers for each service
SRS_WHIP_HOST=publisher.example.com
SRS_WHIP_PORT=1990
SRS_WHIP_USE_HTTPS=true

SRS_WHEP_HOST=viewer.example.com
SRS_WHEP_PORT=8080
SRS_WHEP_USE_HTTPS=true

SRS_API_HOST=api.example.com
SRS_API_PORT=1985
SRS_API_USE_HTTPS=false
```

### Example 3: Mixed Configuration (some new, some legacy)
```bash
# Use separate WHEP server, but inherit WHIP from legacy config
SRS_HOST=cdn2.obedtv.live
SRS_USE_HTTPS=true
SRS_WHIP_PORT=1990

# Override only WHEP to use different server
SRS_WHEP_HOST=viewer.example.com
SRS_WHEP_PORT=8080
SRS_WHEP_USE_HTTPS=true
```

## Frontend Access

The frontend automatically receives all server configurations through the `/api/srs/config` endpoint:

```javascript
// Frontend can access both legacy and new configurations
const config = await getSRSConfig();

// Legacy access (backward compatible)
console.log(config.host, config.whipPort, config.useHttps);

// New separate server access
console.log(config.whip.host, config.whip.port, config.whip.useHttps);
console.log(config.whep.host, config.whep.port, config.whep.useHttps);
console.log(config.api.host, config.api.port, config.api.useHttps);

// Helper URLs are automatically generated
console.log(config.whipBaseUrl); // https://publisher.example.com:1990/rtc/v1/whip/
console.log(config.whepBaseUrl); // https://viewer.example.com:8080/rtc/v1/whep/
console.log(config.apiBaseUrl);  // http://api.example.com:1985/api/v1/
```

## Docker Deployment

Update your `.env` file with the new variables and restart your containers:

```bash
# Stop existing containers
docker-compose down

# Update .env file with new SRS server configurations
nano .env

# Start containers with new configuration
docker-compose up -d
```

The Docker configuration automatically includes all the new environment variables with sensible defaults.

## Use Cases

1. **Load Distribution**: Use separate servers to distribute publishing and viewing load
2. **Geographic Distribution**: Place WHEP servers closer to viewers for better performance  
3. **Security Isolation**: Separate publishing (internal) from viewing (public) networks
4. **Development/Testing**: Use different servers for different environments
5. **CDN Integration**: Use CDN endpoints for WHEP while keeping WHIP on origin servers

## Migration

Existing installations continue to work without any changes. To migrate to separate servers:

1. Add the new environment variables to your `.env` file
2. Restart the application
3. The system will automatically use the new configuration while maintaining backward compatibility

No database changes or migrations are required.