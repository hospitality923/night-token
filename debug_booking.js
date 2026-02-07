const { ethers } = require("ethers");

// Configuration
const RPC_URL = "https://rpc-amoy.polygon.technology/";
const BOOKING_MANAGER_ADDRESS = "0x1D3B95C292774D86556dc9DF70929845C2eb63fb"; // Your deployed address

const ABI = [
    "function bookings(uint256 _bookingId) view returns (uint256 id, address guest, uint256 tokenId, uint256 quantity, string details, uint8 status)",
    "function getBookingCount() view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(BOOKING_MANAGER_ADDRESS, ABI, provider);

    console.log("--- DEBUGGING BOOKING CONTRACT ---");
    
    // 1. Get Total Count
    const count = Number(await contract.getBookingCount());
    console.log(`Total Bookings Count: ${count}`);

    // 2. Check ID 0 (The Ghost)
    console.log("\n--- Checking ID 0 (Should be Empty/Ghost) ---");
    try {
        const b0 = await contract.bookings(0);
        console.log(`ID: ${b0.id}`);
        console.log(`Guest: ${b0.guest}`);
        console.log(`Details: "${b0.details}"`);
        if (b0.guest === "0x0000000000000000000000000000000000000000") {
            console.log("RESULT: ID 0 is indeed an empty ghost record.");
        }
    } catch (e) { console.log("Error reading ID 0:", e.message); }

    // 3. Check ID 1 (Your Real Booking)
    if (count > 0) {
        console.log("\n--- Checking ID 1 (Should be Real) ---");
        const b1 = await contract.bookings(1);
        console.log(`ID: ${b1.id}`);
        console.log(`Guest: ${b1.guest}`);
        console.log(`Details: "${b1.details}"`);
        console.log(`Status: ${b1.status} (0=Active, 1=Completed)`);
    }
}

main();
