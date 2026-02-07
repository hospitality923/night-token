cd /home/night-token

# 1. Stop the containers
docker compose down

# 2. Force a build with NO CACHE (This is the secret sauce)
docker compose build --no-cache frontend

# 3. Start it back up
docker compose up -d
