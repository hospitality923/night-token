const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const { ethers } = require('ethers');
const { verifyToken: authMiddleware } = require('./authMiddleware');
const kmsClient = require('./kmsClient'); 

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- CONSTANTS ---
const FUND_AMOUNT = "0.01";  // 0.01 POL
const MIN_BALANCE = "0.001"; // Threshold to trigger gas funding

// --- DB INITIALIZATION (Ensures tables exist on startup) ---
(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS trades (
                id VARCHAR PRIMARY KEY, status VARCHAR, seller VARCHAR, buyer VARCHAR,
                buyer_addr VARCHAR, token_id VARCHAR, amount INTEGER, lock_tx VARCHAR
            );
            CREATE TABLE IF NOT EXISTS bookings (
                id VARCHAR PRIMARY KEY, status VARCHAR, guest VARCHAR, token_id VARCHAR,
                check_in VARCHAR, check_out VARCHAR, room_count INTEGER, amount INTEGER,
                guest_name VARCHAR, lock_tx VARCHAR
            );
            CREATE TABLE IF NOT EXISTS room_inventory (
                token_id VARCHAR PRIMARY KEY, hotel_id VARCHAR, room_name VARCHAR,
                total_supply INTEGER, public_cap INTEGER, minted_count INTEGER,
                blackout_dates VARCHAR, owner_email VARCHAR
            );
        `);
        // Safely alter existing tables if they were created in an older version
        await db.query(`ALTER TABLE room_inventory ADD COLUMN blackout_dates VARCHAR;`).catch(() => {});
        await db.query(`ALTER TABLE room_inventory ADD COLUMN owner_email VARCHAR;`).catch(() => {});
    } catch (e) { console.error("[DB Init Error]", e); }
})();

const CONTRACT_ADDRESSES = {
    TOKEN: "0xb7844D97c40DDd2AF0e1dec3aFf336141E287629", 
    Manager: "0x18C1aC0917ACf25a10Dcc8A00A03b48f8bC06597" 
};

const TOKEN_ABI = [
    "function mintTokens(address to, uint256 tokenId, uint256 quantity, bytes data) public",
    "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) public",
    "function burn(address account, uint256 id, uint256 value) public",
    "function createRoomType(string memory _hotelId, string memory _roomName) public returns (uint256)",
    "function nextTokenId() view returns (uint256)"
];

// --- GAS HELPER (ON-DEMAND) ---
async function ensureGas(userWalletAddress) {
    const adminWallet = await kmsClient.getWallet();
    const provider = adminWallet.provider;
    const balance = await provider.getBalance(userWalletAddress);
    
    if (balance < ethers.parseEther(MIN_BALANCE)) {
        console.log(`[Gas] Funding user ${userWalletAddress} with ${FUND_AMOUNT} POL...`);
        try {
            const tx = await adminWallet.sendTransaction({ 
                to: userWalletAddress, 
                value: ethers.parseEther(FUND_AMOUNT) 
            });
            await tx.wait();
        } catch (e) { console.error("[Gas Error]", e.message); }
    }
}

// --- AUTH ---
app.post('/auth/register', async (req, res) => {
    const { email, password, role } = req.body;
    const wallet = ethers.Wallet.createRandom();
    try {
        await db.query(
            `INSERT INTO users (email, password, role, wallet_address, private_key) VALUES ($1, $2, $3, $4, $5)`, 
            [email, password, role, wallet.address, wallet.privateKey]
        );
        res.json({ email, role, wallet_address: wallet.address });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query(`SELECT * FROM users WHERE email = $1 AND password = $2`, [email, password]);
        const row = result.rows[0];
        if (!row) return res.status(401).json({ error: "Invalid email or password" });
        const token = jwt.sign({ id: row.id, email: row.email, role: row.role, wallet_address: row.wallet_address }, 'secret', { expiresIn: '1d' });
        res.json({ token, user: row });
    } catch (err) { res.status(500).json({ error: "Internal server error" }); }
});

// --- API STATE (WITH DATA ISOLATION) ---
app.get('/api/state', authMiddleware, async (req, res) => {
    let myTrades = [], myBookings = [], myInventory = [], stats = { totalUsers: 0 };
    try {
        const uRes = await db.query("SELECT COUNT(*) as c FROM users");
        stats.totalUsers = parseInt(uRes.rows[0].c);

        const tQ = `SELECT id, status, seller, buyer, buyer_addr as "buyerAddr", token_id as "tokenId", amount, lock_tx as "lockTx" FROM trades`;
        const bQ = `SELECT id, status, guest, token_id as "tokenId", check_in as "checkIn", check_out as "checkOut", room_count as "roomCount", amount, guest_name as "guestName", lock_tx as "lockTx" FROM bookings`;
        const iQ = `SELECT * FROM room_inventory`;

        if (req.user.role === 'admin') {
            myTrades = (await db.query(tQ)).rows;
            myBookings = (await db.query(bQ)).rows;
            myInventory = (await db.query(iQ)).rows;
        } else if (req.user.role === 'hotel') {
            // Hotel isolation: only see own trades, own bookings against their tokens, and own inventory
            myTrades = (await db.query(tQ + " WHERE seller = $1 OR buyer = $1", [req.user.email])).rows;
            myBookings = (await db.query(bQ + " WHERE token_id IN (SELECT token_id FROM room_inventory WHERE owner_email = $1)", [req.user.email])).rows;
            myInventory = (await db.query(iQ + " WHERE owner_email = $1", [req.user.email])).rows;
        } else {
            // TA sees their own interactions, but requires global inventory list to map Token IDs to Room Names locally
            myTrades = (await db.query(tQ + " WHERE seller = $1 OR buyer = $1", [req.user.email])).rows;
            myBookings = (await db.query(bQ + " WHERE guest = $1", [req.user.email])).rows;
            myInventory = (await db.query(iQ)).rows;
        }

        res.json({ trades: myTrades, bookings: myBookings, inventory: myInventory, stats });
    } catch(e) { 
        console.error("[State Error]", e); 
        res.status(500).json({ error: e.message });
    }
});

// --- TRANSACTIONS & ESCROW ---
app.post('/api/escrow/create', authMiddleware, async (req, res) => {
    const { tokenId, amount, buyerEmail } = req.body;
    try {
        await ensureGas(req.user.wallet_address);
        if (req.user.role === 'hotel') {
            const inv = await db.query("SELECT total_supply, minted_count FROM room_inventory WHERE token_id = $1", [tokenId]);
            const available = Number(inv.rows[0].total_supply) - Number(inv.rows[0].minted_count);
            if (Number(amount) > available) return res.status(400).json({ error: "超发限制" });
        }
        let targetAddress = req.body.buyerAddress; 
        if (buyerEmail) {
            const userRes = await db.query("SELECT wallet_address FROM users WHERE email = $1", [buyerEmail]);
            targetAddress = userRes.rows[0].wallet_address;
        }
        const tradeId = Date.now().toString();
        let tx;
        const adminWallet = await kmsClient.getWallet();
        const tokenContractAdmin = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);

        if (req.user.role === 'hotel') {
             tx = await tokenContractAdmin.mintTokens(adminWallet.address, tokenId, amount, "0x");
             await db.query("UPDATE room_inventory SET minted_count = minted_count + $1 WHERE token_id = $2", [amount, tokenId]);
        } else {
             const userRes = await db.query("SELECT private_key FROM users WHERE id = $1", [req.user.id]);
             const userWallet = new ethers.Wallet(userRes.rows[0].private_key, adminWallet.provider);
             const tokenContractUser = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, userWallet);
             tx = await tokenContractUser.safeTransferFrom(userWallet.address, adminWallet.address, tokenId, amount, "0x");
        }
        await tx.wait();
        await db.query(`INSERT INTO trades (id, status, seller, buyer, buyer_addr, token_id, amount, lock_tx) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [tradeId, 'LOCKED', req.user.email, buyerEmail || targetAddress, targetAddress, tokenId, amount, tx.hash]);
        res.json({ success: true, tradeId, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/book/request', authMiddleware, async (req, res) => {
    const { tokenId, checkIn, checkOut, roomCount, guestName } = req.body;
    try {
        await ensureGas(req.user.wallet_address);

        const invRes = await db.query("SELECT blackout_dates FROM room_inventory WHERE token_id = $1", [tokenId]);
        if (invRes.rows.length > 0 && invRes.rows[0].blackout_dates) {
            const [bStart, bEnd] = invRes.rows[0].blackout_dates.split(' 至 ');
            if (bStart && bEnd) {
                const bs = new Date(bStart);
                const be = new Date(bEnd);
                const ci = new Date(checkIn);
                const co = new Date(checkOut);
                if (ci <= be && co > bs) {
                    return res.status(400).json({ error: `系统拦截: 该凭证在不适用日期 (${invRes.rows[0].blackout_dates}) 期间不可用。` });
                }
            }
        }

        const start = new Date(checkIn); const end = new Date(checkOut);
        const nights = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)); 
        const totalTokens = nights * roomCount;
        const userRes = await db.query("SELECT private_key FROM users WHERE id = $1", [req.user.id]);
        const adminWallet = await kmsClient.getWallet();
        const userWallet = new ethers.Wallet(userRes.rows[0].private_key, adminWallet.provider);
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, userWallet);
        const tx = await tokenContract.safeTransferFrom(userWallet.address, adminWallet.address, tokenId, totalTokens, "0x");
        await tx.wait();
        const bookingId = Date.now().toString();
        await db.query(`INSERT INTO bookings (id, status, guest, token_id, check_in, check_out, room_count, amount, guest_name, lock_tx) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [bookingId, 'PENDING_CHECKIN', req.user.email, tokenId, checkIn, checkOut, roomCount, totalTokens, guestName, tx.hash]);
        res.json({ success: true, bookingId, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- ADMIN MANAGEMENT ---
app.post('/admin/create-inventory', authMiddleware, async (req, res) => {
    const { hotelId, roomName, totalSupply, publicCap, blackoutDates, dayType } = req.body;
    try {
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);
        const fullName = `${roomName} [${dayType}]`; 
        const nextIdBigInt = await tokenContract.nextTokenId();
        const tokenId = nextIdBigInt.toString(); 
        const tx = await tokenContract.createRoomType(hotelId, fullName); await tx.wait();
        
        // Attaches creator's email to DB for hotel data isolation
        await db.query(
            `INSERT INTO room_inventory (token_id, hotel_id, room_name, total_supply, public_cap, minted_count, blackout_dates, owner_email) VALUES ($1, $2, $3, $4, $5, 0, $6, $7)`, 
            [tokenId, hotelId, fullName, totalSupply, publicCap, blackoutDates || "", req.user.email]
        );
        
        res.json({success: true, tokenId, txHash: tx.hash});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/api/escrow/release', authMiddleware, async (req, res) => {
    const { tradeId } = req.body;
    try {
        const tRes = await db.query("SELECT * FROM trades WHERE id = $1", [tradeId]);
        const trade = tRes.rows[0];
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);
        const tx = await tokenContract.safeTransferFrom(adminWallet.address, trade.buyer_addr, trade.token_id, trade.amount, "0x"); await tx.wait();
        await db.query("UPDATE trades SET status = 'RELEASED' WHERE id = $1", [tradeId]);
        res.json({ success: true, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/book/confirm', authMiddleware, async (req, res) => {
    const { bookingId } = req.body;
    try {
        const bRes = await db.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        const booking = bRes.rows[0];
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);
        const tx = await tokenContract.burn(adminWallet.address, booking.token_id, booking.amount); await tx.wait();
        await db.query("UPDATE bookings SET status = 'COMPLETED' WHERE id = $1", [bookingId]);
        res.json({ success: true, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/book/cancel', authMiddleware, async (req, res) => {
    const { bookingId } = req.body;
    try {
        const bRes = await db.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        const booking = bRes.rows[0];
        if (!booking) return res.status(404).json({error: "Booking not found"});
        
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);
        const result = await db.query("SELECT wallet_address FROM users WHERE email = $1", [booking.guest]);
        
        const tx = await tokenContract.safeTransferFrom(adminWallet.address, result.rows[0].wallet_address, booking.token_id, booking.amount, "0x");
        await tx.wait();
        
        await db.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = $1", [bookingId]);
        res.json({ success: true, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- USER CRUD OPERATIONS ---
app.get('/admin/users', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Admin only" });
    try {
        const result = await db.query("SELECT id, email, role, wallet_address FROM users ORDER BY id DESC");
        res.json(result.rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/admin/users', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Admin only" });
    const { email, password, role } = req.body;
    const wallet = ethers.Wallet.createRandom();
    try {
        await db.query("INSERT INTO users (email, password, role, wallet_address, private_key) VALUES ($1, $2, $3, $4, $5)", [email, password, role, wallet.address, wallet.privateKey]);
        await ensureGas(wallet.address); // Seed gas for new user
        res.json({ success: true });
    } catch (err) { res.status(400).json({error: err.message}); }
});

app.put('/admin/users/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Admin only" });
    const { id } = req.params;
    const { email, password, role } = req.body;
    try {
        if (password && password.trim() !== '') {
            await db.query("UPDATE users SET email = $1, password = $2, role = $3 WHERE id = $4", [email, password, role, id]);
        } else {
            await db.query("UPDATE users SET email = $1, role = $2 WHERE id = $3", [email, role, id]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.delete('/admin/users/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Admin only" });
    const { id } = req.params;
    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

// --- RESTORED RESET (With Database Wipe & Seed) ---
app.post("/admin/reset", authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Admin only" });
    try {
        await db.query("TRUNCATE users, room_inventory, trades, bookings RESTART IDENTITY CASCADE");
        
        const defaultUsers = [
            { email: "admin@letone.ai", password: "12345", role: "admin" },
            { email: "admin@hotel.com", password: "12345", role: "hotel" },
            { email: "admin@travel.com", password: "12345", role: "ta" }
        ];

        for (const u of defaultUsers) {
            const wallet = ethers.Wallet.createRandom();
            await db.query(`INSERT INTO users (email, password, role, wallet_address, private_key) VALUES ($1, $2, $3, $4, $5)`, [u.email, u.password, u.role, wallet.address, wallet.privateKey]);
            await ensureGas(wallet.address);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

const PORT = 4000;
app.listen(PORT, () => { console.log(`Backend running on port ${PORT}`); });
