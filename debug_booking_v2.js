const { ethers } = require("ethers");

// --- CONFIGURATION ---
const BOOKING_ID = 3; // The ID of the booking causing the error
const RPC_URL = "https://rpc-amoy.polygon.technology/";

// Addresses from your app.js
const BOOKING_MANAGER_ADDR = "0x1D3B95C292774D86556dc9DF70929845C2eb63fb";
const EXPECTED_TOKEN_ADDR  = "0x04f3DF3e63c5f3fCBEE561314F14351E065c7C3f";

// Minimal ABIs
const MANAGER_ABI = [
    "function roomNightToken() view returns (address)",
    "function bookings(uint256) view returns (uint256 id, address guest, uint256 tokenId, uint256 quantity, string details, uint8 status)"
];

const TOKEN_ABI = [
    "function balanceOf(address account, uint256 id) view returns (uint256)"
];

async function main() {
    console.log(`\n🔍 STARTING DIAGNOSTIC FOR BOOKING #${BOOKING_ID}...\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Create Contract Instances
    const managerContract = new ethers.Contract(BOOKING_MANAGER_ADDR, MANAGER_ABI, provider);
    const tokenContract = new ethers.Contract(EXPECTED_TOKEN_ADDR, TOKEN_ABI, provider);

    try {
        // TEST 1: Check Contract Linkage
        const onChainTokenAddr = await managerContract.roomNightToken();
        
        console.log("1️⃣  CHECKING CONTRACT LINKAGE:");
        console.log(`   Expected Token Address: ${EXPECTED_TOKEN_ADDR}`);
        console.log(`   Manager Linked Address: ${onChainTokenAddr}`);

        if (onChainTokenAddr.toLowerCase() !== EXPECTED_TOKEN_ADDR.toLowerCase()) {
            console.error("\n❌ CRITICAL ERROR: ADDRESS MISMATCH");
            console.error("   The BookingManager is pointed at the WRONG Token Contract.");
            console.error("   Fix: You must redeploy BookingManager with the correct Token Address constructor argument.");
            return; // Stop here, this is fatal
        } else {
            console.log("   ✅ Address Linkage Correct.\n");
        }

        // TEST 2: Check Booking State & Balance
        console.log("2️⃣  CHECKING BOOKING DETAILS & BALANCE:");
        const booking = await managerContract.bookings(BOOKING_ID);
        
        // Status Enum: 0=Active, 1=Completed, 2=Cancelled
        const statusText = ["Active", "Completed", "Cancelled"][booking.status];
        
        console.log(`   Booking Status: ${statusText} (${booking.status})`);
        console.log(`   Guest Address:  ${booking.guest}`);
        console.log(`   Token ID:       ${booking.tokenId}`);
        console.log(`   Quantity:       ${booking.quantity}`);

        if (Number(booking.status) !== 0) {
            console.error("\n❌ ERROR: BOOKING NOT ACTIVE");
            console.error(`   This booking is already ${statusText}. It cannot be cancelled again.`);
            return;
        }

        // Check if Manager actually HAS the tokens to refund
        const managerBalance = await tokenContract.balanceOf(BOOKING_MANAGER_ADDR, booking.tokenId);
        console.log(`   Manager Balance (ID ${booking.tokenId}): ${managerBalance}`);

        if (BigInt(managerBalance) < BigInt(booking.quantity)) {
            console.error("\n❌ CRITICAL ERROR: INSUFFICIENT BALANCE");
            console.error(`   The BookingManager contract needs ${booking.quantity} tokens to refund the guest,`);
            console.error(`   but it only holds ${managerBalance}.`);
            console.error("\n   Fix: Send tokens of ID " + booking.tokenId + " manually to the BookingManager contract address.");
        } else {
            console.log("\n✅ DIAGNOSTIC PASSED: Balance and Addresses look correct.");
            console.log("   If transactions still fail, ensure you are calling cancelBooking() from the GUEST wallet.");
        }

    } catch (error) {
        console.error("\n❌ SCRIPT ERROR:", error.message);
    }
}

main();
