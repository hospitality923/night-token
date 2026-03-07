#!/bin/bash
docker exec -i night-token-backend-1 node -e "
const db = require('./db');
async function run() {
  try {
    console.log('\n=========================================');
    console.log('         👥 USERS IN SYSTEM 👥');
    console.log('=========================================');
    const users = await db.query('SELECT id, email, role, wallet_address FROM users ORDER BY id;');
    console.table(users.rows.length ? users.rows : ['No users found']);

    console.log('\n=========================================');
    console.log('       🏨 TOKENS / INVENTORY 🏨');
    console.log('=========================================');
    const inv = await db.query('SELECT token_id, hotel_id, room_name, total_supply, minted_count FROM room_inventory ORDER BY token_id;');
    console.table(inv.rows.length ? inv.rows : ['No tokens found']);
  } catch(e) {
    console.error('Database Error:', e.message);
  } finally {
    process.exit(0);
  }
}
run();
"
