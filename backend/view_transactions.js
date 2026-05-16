const db = require('./db');

(async () => {
    try {
        console.log("\n=================== TRADES (Asset Transfers & Escrow) ===================");
        const trades = await db.query(`
            SELECT token_id, id AS trade_id, seller, buyer, amount, status 
            FROM trades 
            ORDER BY CAST(token_id AS INTEGER) ASC
        `);
        console.table(trades.rows);

        console.log("\n=================== BOOKINGS (Redemptions & Check-ins) ===================");
        const bookings = await db.query(`
            SELECT token_id, id AS booking_id, guest, amount AS token_cost, check_in, check_out, status 
            FROM bookings 
            ORDER BY CAST(token_id AS INTEGER) ASC
        `);
        console.table(bookings.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
