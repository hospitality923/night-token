const db = require('./db');

(async () => {
    try {
        const res = await db.query("SELECT token_id, hotel_id, room_name, total_supply, owner_email FROM room_inventory ORDER BY CAST(token_id AS INTEGER) ASC");
        console.log("\n--- Current Platform Inventory ---");
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
