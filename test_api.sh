#!/bin/bash
API_URL="http://localhost:4000"
EMAIL="testuser_$(date +%s)@example.com"
PASSWORD="password123"

echo "--- 1. Checking Server Health ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
# Note: If /health isn't defined, express usually returns 404, which proves it's running.
echo "Server responded with code: $HTTP_CODE"
echo ""

echo "--- 2. Registering User ---"
REGISTER_RES=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"role\": \"ta\", \"wallet_address\": \"0xTestWallet_$(date +%s)\"}")
echo "Response: $REGISTER_RES"

echo ""
echo "--- 3. Logging In ---"
LOGIN_RES=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RES | jq -r '.token')
echo "Token Received: ${TOKEN:0:15}..."

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "CRITICAL: Login Failed. Stopping test."
  exit 1
fi

echo ""
echo "--- 4. Testing Smart Lock (Blackout Date: Canton Fair) ---"
# We inserted this rule in db.js: 2026-04-15 to 2026-05-05
# We test a date INSIDE this range: 2026-04-20
CHECK_RES=$(curl -s -X GET "$API_URL/api/check-availability?tokenId=1&date=2026-04-20" \
  -H "Authorization: Bearer $TOKEN")

IS_AVAILABLE=$(echo $CHECK_RES | jq -r '.available')
REASON=$(echo $CHECK_RES | jq -r '.reason')

echo "Date: 2026-04-20"
echo "Available: $IS_AVAILABLE"
echo "Reason: $REASON"

if [ "$IS_AVAILABLE" == "false" ]; then
    echo "SUCCESS: Smart Lock correctly blocked the Canton Fair date."
else
    echo "FAILURE: Smart Lock did not block the date."
fi

echo ""
echo "--- Test Complete ---"
