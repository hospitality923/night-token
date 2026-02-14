#!/bin/bash

API_URL="http://localhost:4000"
ADMIN_EMAIL="admin_test_$(date +%s)@platform.com"
ADMIN_PASS="admin123"

echo "---------------------------------------------------"
echo "Testing Platform Admin Role"
echo "---------------------------------------------------"

# 1. Register as Admin
echo "1. Registering Admin User ($ADMIN_EMAIL)..."
REG_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASS\", \"role\": \"admin\"}")

echo "Response: $REG_RESPONSE"
if [[ "$REG_RESPONSE" == *"error"* ]]; then
    echo "❌ Registration Failed"
    exit 1
fi

# 2. Login as Admin
echo -e "\n2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASS\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login Failed (No Token)"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi
echo "✅ Login Successful! Token acquired."

# 3. Check Admin State (Should see inventory even if empty)
echo -e "\n3. Checking Admin State (Inventory & Trades)..."
STATE_RESPONSE=$(curl -s -X GET "$API_URL/api/state" \
  -H "Authorization: $TOKEN")

# Simple check if inventory array exists in JSON
if [[ "$STATE_RESPONSE" == *"inventory"* ]]; then
    echo "✅ Admin State Fetch Successful"
else
    echo "❌ Admin State Fetch Failed"
    echo "Response: $STATE_RESPONSE"
fi

# 4. Test System Reset Permission
echo -e "\n4. Testing Admin Reset Permission..."
RESET_RESPONSE=$(curl -s -X POST "$API_URL/admin/reset" \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN")

echo "Response: $RESET_RESPONSE"

if [[ "$RESET_RESPONSE" == *"success"* ]]; then
    echo "✅ Admin Reset Successful!"
else
    echo "❌ Admin Reset Failed"
fi

echo -e "\n---------------------------------------------------"
echo "Test Complete"
echo "---------------------------------------------------"
