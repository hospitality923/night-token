# Stop containers
docker compose down -v

# Rebuild with no cache to force npm install
docker compose build --no-cache backend

# Start everything up
docker compose up -d

### 3. Verify Fix
#Once it starts, check the logs again:
#```bash
#docker logs -f night-token-backend-1
#You should see "Backend running on port 4000".

### 4. Run the Test Script
#After the backend is healthy, run your test script again locally:
#```bash
#node test_backend_booking.js

#This should now successfully connect (`fetch`) to the running backend and execute the "Invisible Wallet" booking flow!
