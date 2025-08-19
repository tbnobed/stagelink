#!/bin/bash

# Docker Authentication Test Script for Virtual Audience Platform v2.0
# This script verifies that the authentication system works correctly in Docker

echo "=== Virtual Audience Platform v2.0 Authentication Test ==="
echo ""

# Check if containers are running
echo "1. Checking container status..."
docker-compose ps

echo ""
echo "2. Waiting for application to fully start..."
sleep 15

# Test health endpoint
echo ""
echo "3. Testing application health..."
curl -f http://localhost/health || echo "Health check failed"

echo ""
echo "4. Testing authentication system..."

# Test user endpoint (should return 401)
echo ""
echo "4a. Testing /api/user endpoint (should be 401 unauthorized)..."
curl -s -w "Status: %{http_code}\n" http://localhost/api/user

# Test login with admin/password
echo ""
echo "4b. Testing admin login..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  -w "Status: %{http_code}\n" \
  http://localhost/api/login)

echo "Login response: $LOGIN_RESPONSE"

# Test user endpoint with session
echo ""
echo "4c. Testing authenticated /api/user endpoint..."
curl -s -b cookies.txt -w "Status: %{http_code}\n" http://localhost/api/user

echo ""
echo "5. Checking application logs for admin creation..."
docker-compose logs app | grep -i "admin\|created\|login"

echo ""
echo "6. Checking database for admin user..."
docker-compose exec -T db psql -U postgres -d virtual_audience -c "SELECT id, username, role, created_at FROM users WHERE username='admin';"

# Clean up
rm -f cookies.txt

echo ""
echo "=== Test Complete ==="
echo ""
echo "If you see 'Created default admin user' in the logs and can login with admin/password,"
echo "then the authentication system is working correctly in Docker!"