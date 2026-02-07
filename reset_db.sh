docker compose exec db psql -U nighttoken -d nighttoken -c "TRUNCATE users, room_inventory RESTART IDENTITY CASCADE;" && docker compose restart backend
