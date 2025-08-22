# Docker v2.2 Changelog - User Registration System

## New Features in v2.2

### User Registration System
- Complete redesign of user invitation workflow
- Users now receive registration emails and set their own username/password
- Secure 7-day registration token system with single-use validation
- Registration page with username availability checking and password confirmation
- Automatic username conflict resolution

### Password Reset System
- Secure token-based password reset flow
- Email-based reset with 24-hour token expiration
- Professional email templates via SendGrid
- Comprehensive token validation and cleanup

### Database Schema Updates
- Added `registration_tokens` table with proper indexes
- Added `password_reset_tokens` table with proper indexes
- Comprehensive database migration support in startup script
- All authentication tables properly indexed for performance

### Docker Configuration Updates
- Updated container names to v2.2 (`virtual-audience-app-v2-2`, `virtual-audience-db-v2-2`)
- Updated cache bust identifier for new build
- Enhanced startup messages reflecting new functionality
- Complete database schema creation including all authentication tables

## Technical Improvements

### Email Integration
- SendGrid integration for professional email templates
- Clean email formatting for registration and password reset
- Configurable sender email address (alerts@obedtv.com)
- Professional email templates with clear call-to-action buttons

### Security Enhancements
- Secure token generation for registration and password reset
- Proper token expiration and cleanup
- Single-use registration tokens
- Scrypt-based password hashing maintained

### Database Performance
- Added comprehensive indexes for all new authentication tables
- Optimized query performance for token lookups
- Proper foreign key relationships with user management

## Migration from v2.1

### Automatic Schema Updates
The v2.2 Docker containers will automatically:
1. Create new authentication tables if they don't exist
2. Add proper indexes for performance
3. Maintain all existing data and functionality
4. Create default admin user if needed

### Breaking Changes
None - v2.2 is fully backward compatible with v2.1 data

### New Environment Variables
All existing environment variables remain the same:
- `SENDGRID_API_KEY` - Required for email functionality
- `SENDGRID_FROM_EMAIL` - Sender email address (default: alerts@obedtv.com)

## Deployment Instructions

### For New Installations
```bash
# Clone repository and build
docker-compose up -d

# The system will automatically:
# - Create complete database schema
# - Set up all authentication tables
# - Create default admin user (username: admin, password: password)
```

### For Upgrading from v2.1
```bash
# Stop existing containers
docker-compose down

# Pull new v2.2 configuration
git pull origin main

# Start with new v2.2 containers
docker-compose up -d

# Database will automatically upgrade to include new tables
```

## Verification

After deployment, verify the new features:

1. **Registration System**: Admin users can invite new users via email
2. **Password Reset**: Users can reset passwords via "Forgot Password" link
3. **Email Delivery**: Check SendGrid dashboard for email delivery status
4. **Database Schema**: All new authentication tables should be present with proper indexes

## Support

For issues with the v2.2 deployment:
1. Check container logs: `docker-compose logs app`
2. Verify database schema: Connect to PostgreSQL and check table structure
3. Test email delivery: Use SendGrid dashboard to monitor email status
4. Ensure all environment variables are properly configured