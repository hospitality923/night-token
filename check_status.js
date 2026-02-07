const { ethers } = require("ethers");

// Your Deployed Booking Manager Address
const CONTRACT_ADDRESS = "0x1D3B95C292774D86556dc9DF70929845C2eb63fb";
const RPC_URL = "https://rpc-amoy.polygon.technology/";

const ABI = [
    "function bookings(uint256 _bookingId) view returns (uint256 id, address guest, uint256 tokenId, uint256 quantity, string details, uint8 status)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // We are checking Booking ID 1 (Change this if you need to check ID 2, 3, etc)
    const bookingId = 1;

    console.log(`🔍 Querying Blockchain for Booking #${bookingId}...`);

    try {
        const b = await contract.bookings(bookingId);
        
        // Status Enum: 0=Active, 1=Completed, 2=Cancelled
        const status = Number(b.status); 

        console.log("------------------------------------------------");
        console.log(`Guest Address:  ${b.guest}`);
        console.log(`Details:        ${b.details}`);
        console.log(`Raw Status:     ${status}`);
        console.log("------------------------------------------------");

        if (status === 0) {
            console.log("🟡 STATUS: ACTIVE (Not Cancelled)");
            console.log("👉 Action Required: The Hotel must click 'Cancel' again.");
        } else if (status === 1) {
            console.log("🟢 STATUS: COMPLETED (Checked In)");
        } else if (status === 2) {
            console.log("🔴 STATUS: CANCELLED");
            console.log("✅ Logic Verified: The token has been returned.");
        }

    } catch (e) {
        console.error("Error reading contract:", e.message);
    }
}

main();
