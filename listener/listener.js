require('dotenv').config();
const { ethers } = require('ethers');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ABIs
const tokenABI = [ "event BookingRedeemed(address indexed redeemedBy, uint256 indexed tokenId, uint256 quantity, string bookingDetails)" ];
const escrowABI = [ 
  "event SaleCreated(uint256 indexed saleId, address indexed seller, address indexed buyer, uint256 tokenId, uint256 quantity)",
  "event SaleReleased(uint256 indexed saleId)",
  "event SaleCancelled(uint256 indexed saleId)"
];

async function main() {
  console.log("Starting Blockchain Polling Service...");
  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_API_URL); 

  // Define Contracts
  const tokenContract = new ethers.Contract(process.env.ROOM_NIGHT_TOKEN_ADDRESS, tokenABI, provider);
  const escrowContract = new ethers.Contract(process.env.TOKEN_ESCROW_ADDRESS, escrowABI, provider);

  // State tracking
  let lastBlock = await provider.getBlockNumber();
  console.log(`Initialized at block: ${lastBlock}`);

  // Polling Loop (Every 6 seconds - approx Polygon block time is 2s, so we catch batches)
  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      
      // Only query if there are new blocks
      if (currentBlock > lastBlock) {
        // console.log(`Checking blocks ${lastBlock + 1} to ${currentBlock}...`);

        // --- 1. Check Bookings ---
        const bookingEvents = await tokenContract.queryFilter("BookingRedeemed", lastBlock + 1, currentBlock);
        for (const event of bookingEvents) {
            const { redeemedBy, tokenId, quantity, bookingDetails } = event.args;
            console.log(`[Booking] ${bookingDetails} by ${redeemedBy}`);
            await saveBooking(redeemedBy, tokenId, quantity, bookingDetails, event.transactionHash);
        }

        // --- 2. Check Escrow Sales ---
        const saleEvents = await escrowContract.queryFilter("SaleCreated", lastBlock + 1, currentBlock);
        for (const event of saleEvents) {
            const { saleId, seller, buyer, tokenId, quantity } = event.args;
            console.log(`[Sale Created] ID ${saleId}`);
            await saveSale(saleId, seller, buyer, tokenId, quantity, event.transactionHash);
        }

        // --- 3. Check Releases ---
        const releaseEvents = await escrowContract.queryFilter("SaleReleased", lastBlock + 1, currentBlock);
        for (const event of releaseEvents) {
            const { saleId } = event.args;
            console.log(`[Sale Released] ID ${saleId}`);
            await updateSaleStatus(saleId, 'Released', event.transactionHash);
        }

        // --- 4. Check Cancellations ---
        const cancelEvents = await escrowContract.queryFilter("SaleCancelled", lastBlock + 1, currentBlock);
        for (const event of cancelEvents) {
            const { saleId } = event.args;
            console.log(`[Sale Cancelled] ID ${saleId}`);
            await updateSaleStatus(saleId, 'Cancelled', event.transactionHash);
        }

        // Update pointer
        lastBlock = currentBlock;
      }
    } catch (err) {
      console.error("Polling Error:", err.message);
      // Don't crash, just wait for next tick
    }
  }, 6000); // Run every 6 seconds
}

// --- DB Helper Functions ---

async function saveBooking(redeemedBy, tokenId, qty, details, txHash) {
    const client = await pool.connect();
    try {
        const { rows } = await client.query("SELECT id FROM users WHERE wallet_address = $1", [redeemedBy]);
        if (rows.length) {
            await client.query(
                "INSERT INTO bookings (user_id, token_id, quantity, booking_details, tx_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
                [rows[0].id, tokenId.toString(), qty.toString(), details, txHash]
            );
        }
    } catch(e) { console.error("DB Error (Booking):", e); } finally { client.release(); }
}

async function saveSale(saleId, seller, buyer, tokenId, qty, txHash) {
    const client = await pool.connect();
    try {
        await client.query(
            "INSERT INTO sales (sale_id, seller_wallet, buyer_wallet, token_id, quantity, created_tx_hash) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
            [saleId.toString(), seller, buyer, tokenId.toString(), qty.toString(), txHash]
        );
    } catch(e) { console.error("DB Error (Sale):", e); } finally { client.release(); }
}

async function updateSaleStatus(saleId, status, txHash) {
    const client = await pool.connect();
    try {
        await client.query(
            "UPDATE sales SET state = $1, final_tx_hash = $2 WHERE sale_id = $3", 
            [status, txHash, saleId.toString()]
        );
    } catch(e) { console.error("DB Error (Update):", e); } finally { client.release(); }
}

main();
