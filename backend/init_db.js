const db = require('./db');

async function init() {
  try {
    console.log("⏳ Creating tables...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT,
        wallet_address TEXT
      );
    `);
    console.log("✅ Table 'users' created.");

    await db.query(`
      CREATE TABLE IF NOT EXISTS room_inventory (
        token_id INTEGER PRIMARY KEY,
        hotel_id TEXT,
        room_name TEXT,
        total_supply INTEGER,
        public_cap INTEGER,
        minted_count INTEGER DEFAULT 0
      );
    `);
    console.log("✅ Table 'room_inventory' created.");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error initializing DB:", err);
    process.exit(1);
  }
}

init();
