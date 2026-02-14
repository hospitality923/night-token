#!/bin/bash

# Configuration
API="http://localhost:4000"
HOTEL_EMAIL="hotel_$(date +%s)@test.com"
TA_EMAIL="ta_$(date +%s)@test.com"
PASS="password123"

# --- Helper Functions for JSON Parsing ---
extract_value() {
    echo $1 | grep -o "\"$2\":\"[^\"]*\"" | cut -d'"' -f4
}
extract_int() {
    echo $1 | grep -o "\"$2\":[0-9]*" | cut -d':' -f2
}

echo "============================================="
echo "   🧪 NIGHT TOKEN: BOOKING FLOW TEST"
echo "============================================="

# 1. Register Hotel
echo -n "1. Registering Hotel... "
RES=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$HOTEL_EMAIL\",\"password\":\"$PASS\",\"role\":\"hotel\"}")
if [[ $RES != *"id"* ]]; then echo "❌ Failed: $RES"; exit 1; fi
echo "✅ ($HOTEL_EMAIL)"

# 2. Login Hotel
echo -n "2. Logging in Hotel... "
RES=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$HOTEL_EMAIL\",\"password\":\"$PASS\"}")
HOTEL_TOKEN=$(extract_value "$RES" "token")
echo "✅"

# 3. Reset System (Start Fresh)
echo -n "3. Resetting System Database... "
curl -s -X POST "$API/admin/reset" -H "Authorization: $HOTEL_TOKEN" > /dev/null
echo "✅"

# --- RE-REGISTER AFTER RESET ---
# Since DB was wiped, we must re-create the users
curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$HOTEL_EMAIL\",\"password\":\"$PASS\",\"role\":\"hotel\"}" > /dev/null
RES=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$HOTEL_EMAIL\",\"password\":\"$PASS\"}")
HOTEL_TOKEN=$(extract_value "$RES" "token")

# 4. Create Inventory
echo -n "4. Creating Inventory (Room Type)... "
RES=$(curl -s -X POST "$API/admin/create-inventory" -H "Authorization: $HOTEL_TOKEN" -H "Content-Type: application/json" \
    -d '{"hotelId":"H1","roomName":"Deluxe Suite","totalSupply":100,"publicCap":50,"dayType":"WEEKDAY"}')
TOKEN_ID=$(extract_value "$RES" "tokenId")
if [ -z "$TOKEN_ID" ]; then echo "❌ Failed to create inventory"; exit 1; fi
echo "✅ (Token ID: $TOKEN_ID)"

# 5. Register TA
echo -n "5. Registering Travel Agency... "
curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$TA_EMAIL\",\"password\":\"$PASS\",\"role\":\"ta\"}" > /dev/null
RES=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$TA_EMAIL\",\"password\":\"$PASS\"}")
TA_TOKEN=$(extract_value "$RES" "token")
echo "✅ ($TA_EMAIL)"

# 6. Fund TA (Hotel sends 20 tokens)
echo -n "6. Funding TA (Sending 20 Tokens)... "
# A. Create Escrow/Trade
RES=$(curl -s -X POST "$API/api/escrow/create" -H "Authorization: $HOTEL_TOKEN" -H "Content-Type: application/json" \
    -d "{\"tokenId\":\"$TOKEN_ID\",\"amount\":20,\"buyerEmail\":\"$TA_EMAIL\"}")
TRADE_ID=$(extract_value "$RES" "tradeId")
# B. Release Trade
curl -s -X POST "$API/api/escrow/release" -H "Authorization: $HOTEL_TOKEN" -H "Content-Type: application/json" \
    -d "{\"tradeId\":\"$TRADE_ID\"}" > /dev/null
echo "✅"

# 7. Execute Booking
# Scenario: 3 Nights x 2 Rooms = 6 Tokens Cost
CHECKIN="2024-05-01"
CHECKOUT="2024-05-04"
ROOMS=2
EXPECTED_COST=6

echo "--------------------------------============="
echo "   📝 BOOKING REQUEST"
echo "   📅 Check-In:  $CHECKIN"
echo "   📅 Check-Out: $CHECKOUT"
echo "   🏨 Rooms:     $ROOMS"
echo "   💰 Expected Cost: $EXPECTED_COST Tokens"
echo "--------------------------------============="

echo -n "7. Submitting Booking Request... "
RES=$(curl -s -X POST "$API/api/book/request" -H "Authorization: $TA_TOKEN" -H "Content-Type: application/json" \
    -d "{\"tokenId\":\"$TOKEN_ID\",\"checkIn\":\"$CHECKIN\",\"checkOut\":\"$CHECKOUT\",\"roomCount\":$ROOMS,\"guestName\":\"VIP Guest\"}")

BOOKING_ID=$(extract_value "$RES" "bookingId")

if [[ $RES == *"success"* ]]; then
    echo "✅ Success! (Booking ID: $BOOKING_ID)"
else
    echo "❌ Failed!"
    echo "Response: $RES"
    exit 1
fi

# 8. Verify Calculation
echo -n "8. Verifying Token Deduction... "
STATE=$(curl -s -X GET "$API/api/state" -H "Authorization: $TA_TOKEN")

# Search for the specific amount in the response
if [[ $STATE == *"\"amount\":$EXPECTED_COST"* ]]; then
    echo "✅ Verified! Found booking with cost: $EXPECTED_COST"
else
    echo "❌ Verification Failed!"
    echo "   Could not find a booking with amount: $EXPECTED_COST"
    echo "   State Dump: $STATE"
    exit 1
fi

echo "============================================="
echo "   🎉 TEST PASSED: ALL FEATURES WORKING"
echo "============================================="
