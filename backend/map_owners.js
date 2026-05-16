const db = require('./db');

(async () => {
    try {
        await db.query(`ALTER TABLE room_inventory ADD COLUMN IF NOT EXISTS owner_email VARCHAR;`).catch(() => {});

        // 1. Map tokens 49 and 50 to the 'Anji WDM' account (User ID 10)
        await db.query(`UPDATE room_inventory SET owner_email = 'Anji WDM' WHERE token_id IN ('49', '50')`);

        // 2. Map token 51, plus all SHILTON tokens, to 'admin@hotel.com' (User ID 2)
        await db.query(`UPDATE room_inventory SET owner_email = 'admin@hotel.com' WHERE token_id IN ('44', '46', '47', '48', '51', '52')`);

        console.log("\n✅ Successfully updated token ownership!");
        const res = await db.query("SELECT token_id, hotel_id, owner_email FROM room_inventory ORDER BY CAST(token_id AS INTEGER) ASC");
        console.table(res.rows);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
