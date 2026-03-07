#!/bin/bash

echo "Creating Platform Admin (admin@letone.ai)..."
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@letone.ai","password":"12345","role":"admin"}'

echo -e "\n\nCreating Hotel Admin (admin@hotel.com)..."
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotel.com","password":"12345","role":"hotel"}'

echo -e "\n\nCreating Travel Agent Admin (admin@travel.com)..."
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@travel.com","password":"12345","role":"ta"}'

echo -e "\n\n✅ 3 Test Users Created Successfully!"
