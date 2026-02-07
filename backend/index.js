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

// --- IN-MEMORY STATE ---
const TRADES = {}; 
const BOOKINGS = {}; 

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

// --- AUTH ---
app.post('/auth/register', async (req, res) => {
    const { email, password, role } = req.body;
    const wallet = ethers.Wallet.createRandom();
    
    try {
        const result = await db.query(
            `INSERT INTO users (email, password, role, wallet_address, private_key) VALUES ($1, $2, $3, $4, $5) RETURNING id`, 
            [email, password, role, wallet.address, wallet.privateKey]
        );
        
        // Auto-fund gas
        const adminWallet = await kmsClient.getWallet();
        await adminWallet.sendTransaction({ to: wallet.address, value: ethers.parseEther("0.1") });

        res.json({ id: result.rows[0].id, email, role, wallet_address: wallet.address });
    } catch (err) {
        return res.status(400).json({ error: "Registration failed: " + err.message });
    }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query(`SELECT * FROM users WHERE email = $1 AND password = $2`, [email, password]);
        const row = result.rows[0];
        if (!row) return res.status(401).json({ error: "Invalid credentials" });
        
        const token = jwt.sign({ id: row.id, email: row.email, role: row.role, wallet_address: row.wallet_address }, 'secret', { expiresIn: '1d' });
        res.json({ token, user: row });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STATE ---
app.get('/api/state', authMiddleware, async (req, res) => {
    const myTrades = Object.values(TRADES).filter(t => t.seller === req.user.email || t.buyer === req.user.email);
    const myBookings = Object.values(BOOKINGS).filter(b => b.guest === req.user.email || req.user.role === 'hotel');
    
    // [ADDED] Fetch inventory list for UI display
    let inventory = [];
    try {
        const invRes = await db.query("SELECT * FROM room_inventory");
        inventory = invRes.rows;
    } catch(e) { console.error("Inv fetch error", e); }

    res.json({ trades: myTrades, bookings: myBookings, inventory });
});

// --- ACTIONS ---
app.post('/admin/create-inventory', authMiddleware, async (req, res) => {
    const { hotelId, roomName, totalSupply, publicCap, blackoutDates, dayType } = req.body;
    try {
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);
        const fullName = `${roomName} [${dayType}]`; 

        const nextIdBigInt = await tokenContract.nextTokenId();
        const tokenId = nextIdBigInt.toString(); 

        console.log(`[Admin] Creating Room: ${fullName} (ID: ${tokenId})`);
        const tx = await tokenContract.createRoomType(hotelId, fullName);
        await tx.wait();

        await db.query(
            `INSERT INTO room_inventory (token_id, hotel_id, room_name, total_supply, public_cap, minted_count) 
             VALUES ($1, $2, $3, $4, $5, 0)`, 
            [tokenId, hotelId, fullName, totalSupply, publicCap]
        );
        res.json({success: true, tokenId, txHash: tx.hash});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/api/escrow/create', authMiddleware, async (req, res) => {
    const { tokenId, amount, buyerEmail } = req.body;
    try {
        // --- NEW: EMAIL LOOKUP LOGIC ---
        let targetAddress = req.body.buyerAddress; // Fallback if direct address provided

        if (buyerEmail) {
            console.log(`[Escrow] Looking up wallet for email: ${buyerEmail}`);
            const userRes = await db.query("SELECT wallet_address FROM users WHERE email = $1", [buyerEmail]);
            if (userRes.rows.length === 0) {
                return res.status(404).json({ error: `User with email ${buyerEmail} not found. Please register them first.` });
            }
            targetAddress = userRes.rows[0].wallet_address;
            console.log(`[Escrow] Found address: ${targetAddress}`);
        }

        if (!targetAddress) return res.status(400).json({ error: "Buyer address or valid email required" });

        const tradeId = Date.now().toString();
        
        let tx;
        if (req.user.role === 'hotel') {
             // Hotel Mints
             const adminWallet = await kmsClient.getWallet();
             const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);
             tx = await tokenContract.mintTokens(adminWallet.address, tokenId, amount, "0x");
        } else {
             // User Transfers
             const userRes = await db.query("SELECT private_key FROM users WHERE id = $1", [req.user.id]);
             if (!userRes.rows[0].private_key) return res.status(400).json({error: "User key lost. Please re-register."});
             
             const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_API_URL || 'https://rpc-amoy.polygon.technology/');
             const userWallet = new ethers.Wallet(userRes.rows[0].private_key, provider);
             const adminWallet = await kmsClient.getWallet();
             const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, userWallet);
             
             tx = await tokenContract.safeTransferFrom(userWallet.address, adminWallet.address, tokenId, amount, "0x");
        }
        await tx.wait();

        TRADES[tradeId] = {
            id: tradeId, status: 'LOCKED', seller: req.user.email,
            buyer: buyerEmail || targetAddress, buyerAddr: targetAddress,
            tokenId, amount, lockTx: tx.hash
        };
        res.json({ success: true, tradeId, txHash: tx.hash });
    } catch (e) { console.error(e); res.status(500).json({error: e.message}); }
});

app.post('/api/escrow/release', authMiddleware, async (req, res) => {
    const { tradeId } = req.body;
    const trade = TRADES[tradeId];
    if(!trade || trade.status !== 'LOCKED') return res.status(400).json({error: "Invalid trade"});
    
    try {
        console.log(`[Escrow] Releasing to ${trade.buyerAddr}...`);
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);

        const tx = await tokenContract.safeTransferFrom(adminWallet.address, trade.buyerAddr, trade.tokenId, trade.amount, "0x");
        await tx.wait();

        trade.status = 'RELEASED';
        res.json({ success: true, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// ... (Booking endpoints remain same) ...
app.post('/api/book/request', authMiddleware, async (req, res) => {
    const { tokenId, date, guestName } = req.body;
    try {
        const userRes = await db.query("SELECT private_key FROM users WHERE id = $1", [req.user.id]);
        if (!userRes.rows[0].private_key) return res.status(400).json({error: "User key lost."});

        const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_API_URL || 'https://rpc-amoy.polygon.technology/');
        const userWallet = new ethers.Wallet(userRes.rows[0].private_key, provider);
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, userWallet);

        const tx = await tokenContract.safeTransferFrom(userWallet.address, adminWallet.address, tokenId, 1, "0x");
        await tx.wait();

        const bookingId = Date.now().toString();
        BOOKINGS[bookingId] = {
            id: bookingId, status: 'PENDING_CHECKIN', guest: req.user.email,
            tokenId, date, guestName, lockTx: tx.hash
        };
        res.json({ success: true, bookingId, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/book/confirm', authMiddleware, async (req, res) => {
    const { bookingId } = req.body;
    const booking = BOOKINGS[bookingId];
    try {
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);
        const tx = await tokenContract.burn(adminWallet.address, booking.tokenId, 1);
        await tx.wait();
        booking.status = 'COMPLETED';
        res.json({ success: true, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/book/cancel', authMiddleware, async (req, res) => {
    const { bookingId } = req.body;
    const booking = BOOKINGS[bookingId];
    try {
        const adminWallet = await kmsClient.getWallet();
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, adminWallet);
        const result = await db.query("SELECT wallet_address FROM users WHERE email = $1", [booking.guest]);
        const tx = await tokenContract.safeTransferFrom(adminWallet.address, result.rows[0].wallet_address, booking.tokenId, 1, "0x");
        await tx.wait();
        booking.status = 'CANCELLED';
        res.json({ success: true, txHash: tx.hash });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- SYSTEM RESET ---
app.post("/admin/reset", authMiddleware, async (req, res) => {
    if(req.user.role !== "hotel") return res.status(403).json({error: "Admin only"});
    try {
        // 1. Wipe DB
        await db.query("TRUNCATE users, room_inventory RESTART IDENTITY CASCADE");
        // 2. Clear In-Memory State
        for (const key in TRADES) delete TRADES[key];
        for (const key in BOOKINGS) delete BOOKINGS[key];
        console.log("[System] HARD RESET TRIGGERED BY ADMIN");
        res.json({ success: true, message: "System wiped successfully" });
    } catch (e) { res.status(500).json({error: e.message}); }
});

const PORT = 4000;
app.listen(PORT, () => { console.log(`Backend running on port ${PORT}`); });
