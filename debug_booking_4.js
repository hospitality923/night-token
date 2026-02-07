const { ethers } = require("ethers");

// --- CONFIGURATION ---
const BOOKING_ID = 4; // Based on your latest screenshot
const RPC_URL = "https://rpc-amoy.polygon.technology/";

// Addresses
const BOOKING_MANAGER_ADDR = "0x1D3B95C292774D86556dc9DF70929845C2eb63fb";
const TOKEN_ADDR = "0x04f3DF3e63c5f3fCBEE561314F14351E065c7C3f";

const MANAGER_ABI = [
    "function bookings(uint256) view returns (uint256 id, address guest, uint256 tokenId, uint256 quantity, string details, uint8 status)"
];

const TOKEN_ABI = [
    "function balanceOf(address account, uint256 id) view returns (uint256)"
];

async function main() {
    console.log(`\n🔍 DIAGNOSTIC FOR BOOKING #${BOOKING_ID}...\n`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const manager = new ethers.Contract(BOOKING_MANAGER_ADDR, MANAGER_ABI, provider);
    const token = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, provider);

    try {
        // 1. Get Booking Details
        const b = await manager.bookings(BOOKING_ID);
        console.log("📋 BOOKING RECORD:");
        // Status: 0=Active, 1=Completed, 2=Cancelled
        const statusStr = ['Active', 'Completed', 'Cancelled'][b.status] || "Unknown";
        console.log(`   - Status:   ${statusStr} (${b.status})`);
        console.log(`   - Guest:    ${b.guest}`);
        console.log(`   - Token ID: ${b.tokenId}`);
        console.log(`   - Quantity: ${b.quantity}`);
        console.log(`   - Details:  ${b.details}`);

        if (Number(b.status) !== 0) {
             console.log("\n⚠️ NOTE: This booking is NOT Active. It cannot be cancelled.");
             return;
        }

        // 2. Check Contract Balance (CRITICAL)
        // The contract MUST hold the token to be able to refund it.
        const balance = await token.balanceOf(BOOKING_MANAGER_ADDR, b.tokenId);
        console.log(`\n💰 CONTRACT BALANCE Check:`);
        console.log(`   - BookingManager holds: ${balance} of Token ID ${b.tokenId}`);
        console.log(`   - Required for Refund:  ${b.quantity}`);

        if (Number(balance) < Number(b.quantity)) {
            console.error("\n❌ CRITICAL ISSUE FOUND: INSUFFICIENT BALANCE");
            console.error("   The BookingManager contract does NOT have the token to refund.");
            console.error("   This is why the cancellation is failing.");
            console.error("   FIX: Manually transfer 1 unit of Token ID " + b.tokenId + " to " + BOOKING_MANAGER_ADDR);
        } else {
            console.log("\n✅ Balance check passed. Contract has the funds.");
            console.log("   If it still fails, the issue might be gas limits (try increasing to 750000).");
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

main();
