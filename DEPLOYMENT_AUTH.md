# Virtual Audience Platform v2.0 - Authentication Deployment Guide

## 🔐 Authentication Features

Virtual Audience Platform now includes a complete authentication system:

- **User Management**: Admin and user roles with role-based access control
- **Secure Authentication**: Custom username/password authentication with scrypt hashing
- **Session Management**: PostgreSQL-backed sessions for scalability
- **Profile Management**: Users can change passwords securely
- **Admin Panel**: Admins can create/delete users and manage platform

## 🚀 Quick Deployment (Production Ready)

### 1. Clone and Configure

```bash
git clone <your-repo>
cd virtual-audience-platform
cp .env.example .env
```

### 2. Update Environment Variables

Edit `.env` and change these important settings:

```bash
# CRITICAL: Change this to a strong, unique secret!
SESSION_SECRET=your-super-secure-session-secret-here

# Database password (recommended to change)
POSTGRES_PASSWORD=your-secure-db-password

# Update database URL with your password
DATABASE_URL=postgresql://postgres:your-secure-db-password@db:5432/virtual_audience
```

### 3. Deploy with Docker

```bash
# Build and start the application
docker-compose up -d

# Check logs
docker-compose logs -f app

# Verify deployment
curl http://localhost/health
```

## 🔑 Default Admin Account

The system creates a default admin account on first startup:

- **Username**: `admin`
- **Password**: `password`

**⚠️ SECURITY WARNING**: Change this password immediately after first login!

1. Log in at `http://your-domain/auth`
2. Click your username → "Profile"
3. Change password in the profile section

## 👥 User Management

### Admin Capabilities
- Access Admin Panel at `/admin`
- Create new users with admin or user roles
- Delete users (except themselves)
- View all user accounts

### User Capabilities
- Access streaming features (Generator, Links, Viewer)
- Change their own password via Profile page
- Create and manage streaming links

## 🔒 Security Features

### Password Security
- All passwords hashed with **scrypt** algorithm + salt
- No plain text passwords stored anywhere
- Secure password comparison using timing-safe methods

### Session Security
- Sessions stored in PostgreSQL (not memory)
- Configurable session timeout
- Secure HTTP-only cookies
- CSRF protection enabled

### Database Security
- User roles and permissions properly configured
- Foreign key constraints for data integrity
- Indexed queries for performance

## 🛠️ Production Deployment Checklist

### Before Deployment
- [ ] Change `SESSION_SECRET` to a strong, unique value
- [ ] Update default database password
- [ ] Configure firewall to block direct database access (port 5432)
- [ ] Set up SSL/TLS if using custom domain
- [ ] Configure backups for PostgreSQL data

### After Deployment
- [ ] Run `./test-docker-auth.sh` to verify authentication system
- [ ] Access application and verify login works
- [ ] Log in with default admin account (admin/password)
- [ ] Change admin password immediately via Profile page
- [ ] Create regular user accounts via Admin panel
- [ ] Test streaming functionality with authenticated users
- [ ] Verify session persistence across container restarts

## 🔧 Troubleshooting

### Quick Authentication Test

Run the automated test script:
```bash
./test-docker-auth.sh
```

### Authentication Issues

**Can't log in with admin/password:**
```bash
# Check if admin user was created
docker-compose exec db psql -U postgres -d virtual_audience -c "SELECT username, role FROM users;"

# Check application logs for admin creation
docker-compose logs app | grep -i "admin\|created\|setup"

# Restart containers if admin wasn't created
docker-compose down && docker-compose up -d
```

**Session not persisting:**
```bash
# Verify session table exists
docker-compose exec db psql -U postgres -d virtual_audience -c "\dt session"

# Check session secret is set
docker-compose exec app env | grep SESSION_SECRET
```

### Database Connection Issues
```bash
# Test database connectivity
docker-compose exec app node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => console.log('DB OK')).catch(console.error);
"
```

## 📊 Monitoring

### Health Checks
- Application health: `http://your-domain/health`
- Database status: Built into Docker health checks
- Authentication status: Try accessing `/` (should redirect to `/auth` if not logged in)

### Logs
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f db

# All services
docker-compose logs -f
```

## 🔄 Updates and Maintenance

### Password Management
- Users can change passwords via Profile page
- Admins should regularly audit user accounts
- Consider implementing password policies if needed

### Session Management
- Sessions automatically expire based on configuration
- Session data stored in PostgreSQL for persistence
- Clean expired sessions automatically handled

### Database Maintenance
- Regular PostgreSQL backups recommended
- Monitor disk usage for session and user data
- Consider user cleanup policies for inactive accounts

## 🚨 Security Recommendations

1. **Change Default Passwords**: Always change the default admin password
2. **Strong Session Secret**: Use a cryptographically secure session secret
3. **Regular Updates**: Keep the application and dependencies updated
4. **Access Control**: Limit admin accounts to trusted users only
5. **Network Security**: Use firewalls to restrict database access
6. **SSL/TLS**: Enable HTTPS for production deployments
7. **Backup Strategy**: Regular backups of user data and sessions

---

**Virtual Audience Platform v2.0** - Professional live streaming with enterprise authentication