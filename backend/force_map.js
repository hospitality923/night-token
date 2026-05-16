const db = require('./db');

(async () => {
    try {
        console.log("Assigning tokens 49 and 50 to 'Anji WDM'...");
        await db.query(`UPDATE room_inventory SET owner_email = 'Anji WDM' WHERE token_id IN ('49', '50')`);

        console.log("Assigning all other existing tokens to 'admin@hotel.com'...");
        await db.query(`UPDATE room_inventory SET owner_email = 'admin@hotel.com' WHERE token_id NOT IN ('49', '50')`);

        console.log("\n✅ Verifying database records:");
        const res = await db.query("SELECT token_id, room_name, owner_email FROM room_inventory ORDER BY CAST(token_id AS INTEGER) ASC");
        console.table(res.rows);

        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
})();
