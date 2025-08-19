#!/bin/bash

# Virtual Audience Platform - API Testing Script
# Tests the new link sharing API endpoints

BASE_URL="http://localhost"
if [ "$1" ]; then
    BASE_URL="$1"
fi

echo "🧪 Testing Virtual Audience Platform v2.0 API (with QR Code support) at $BASE_URL"
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
if curl -f "$BASE_URL/health" &> /dev/null; then
    echo "   ✅ Health check passed"
else
    echo "   ❌ Health check failed"
    exit 1
fi

# Test getting links (should be empty initially)
echo ""
echo "2. Testing GET /api/links..."
response=$(curl -s "$BASE_URL/api/links")
echo "   Response: $response"

# Test creating a link
echo ""
echo "3. Testing POST /api/links..."
test_link='{
    "id": "test-'$(date +%s)'",
    "streamName": "test-stream",
    "returnFeed": "studio1", 
    "chatEnabled": true,
    "url": "http://localhost/session?stream=test-stream&return=studio1&chat=true",
    "expiresAt": null
}'

create_response=$(curl -s -X POST "$BASE_URL/api/links" \
    -H "Content-Type: application/json" \
    -d "$test_link")
echo "   Response: $create_response"

# Get the created link ID
link_id=$(echo "$create_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# Test getting links again (should have one now)
echo ""
echo "4. Testing GET /api/links again..."
response=$(curl -s "$BASE_URL/api/links")
echo "   Response: $response"

# Test deleting the link
if [ "$link_id" ]; then
    echo ""
    echo "5. Testing DELETE /api/links/$link_id..."
    delete_response=$(curl -s -X DELETE "$BASE_URL/api/links/$link_id")
    echo "   Response: $delete_response"
    
    # Verify it's deleted
    echo ""
    echo "6. Verifying deletion..."
    response=$(curl -s "$BASE_URL/api/links")
    echo "   Response: $response"
fi

echo ""
echo "✅ API testing completed!"
echo ""
echo "🔗 Available API Endpoints:"
echo "   GET    $BASE_URL/health           - Health check"
echo "   GET    $BASE_URL/api/links       - List all links"
echo "   POST   $BASE_URL/api/links       - Create new link"
echo "   DELETE $BASE_URL/api/links/:id   - Delete specific link"
echo "   DELETE $BASE_URL/api/links       - Delete expired links"
echo ""
echo "🆕 v2.0 Features Available:"
echo "   ✓ QR Code generation for all links"
echo "   ✓ Cross-browser link sharing"
echo "   ✓ Real-time link synchronization"
echo "   ✓ Link expiration management"
echo "   ✓ WHIP/WHEP streaming support"
echo "   ✓ Live stream preview functionality"