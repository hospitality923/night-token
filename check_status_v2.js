const { ethers } = require("ethers");

// --- CONFIGURATION ---
// This is your NEW Booking Manager Address (from your latest deployment)
const CONTRACT_ADDRESS = "0x1D3B95C292774D86556dc9DF70929845C2eb63fb";
const RPC_URL = "https://rpc-amoy.polygon.technology/";

const ABI = [
    "function bookings(uint256 _bookingId) view returns (uint256 id, address guest, uint256 tokenId, uint256 quantity, string details, uint8 status)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    const bookingId = 1;

    console.log(`\n🔍 Checking Booking #${bookingId} on Contract: ${CONTRACT_ADDRESS}`);
    console.log("------------------------------------------------");

    try {
        const b = await contract.bookings(bookingId);
        
        // Status Enum: 0=Active, 1=Completed, 2=Cancelled
        const status = Number(b.status); 

        console.log(`Guest Address:  ${b.guest}`);
        console.log(`Details:        ${b.details}`);
        console.log(`Raw Status:     ${status}`);
        console.log("------------------------------------------------");

        if (status === 0) {
            console.log("🟡 STATUS: ACTIVE (0)");
            console.log("❌ Result: The booking is NOT cancelled yet on this specific contract.");
        } else if (status === 1) {
            console.log("🟢 STATUS: COMPLETED (1)");
        } else if (status === 2) {
            console.log("🔴 STATUS: CANCELLED (2)");
            console.log("✅ Result: The booking is successfully cancelled.");
        }

    } catch (e) {
        console.error("Error reading contract (Is the address correct?):", e.message);
    }
    console.log("\n");
}

main();
