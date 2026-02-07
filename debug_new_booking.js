const { ethers } = require("ethers");

// --- CONFIGURATION ---
// I extracted this specific wallet from your error screenshot (0xb844...)
const USER_ADDRESS = "0xB844535AaF18be407A1fb96E646Bf8C2bdf6A181"; 
const TOKEN_ID_TO_BOOK = 1; // The ID you are trying to book (from screenshot)

const RPC_URL = "https://rpc-amoy.polygon.technology/";
const TOKEN_ADDRESS = "0x04f3DF3e63c5f3fCBEE561314F14351E065c7C3f";
const BOOKING_MANAGER_ADDRESS = "0x1D3B95C292774D86556dc9DF70929845C2eb63fb";

// Minimal ABI
const TOKEN_ABI = [
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function roomTypeInfo(uint256 id) view returns (string hotelId, string roomName, bool isDefined)"
];

async function main() {
    console.log(`\n🔍 DIAGNOSTIC FOR NEW BOOKING (User: ${USER_ADDRESS.substring(0,8)}...)\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);

    try {
        // 1. Check if the Token ID even exists
        const info = await tokenContract.roomTypeInfo(TOKEN_ID_TO_BOOK);
        if (!info.isDefined) {
            console.error(`❌ CRITICAL ERROR: Room Type ID ${TOKEN_ID_TO_BOOK} does not exist!`);
            console.error("   Fix: You are trying to book a room ID that hasn't been created yet.");
            return;
        }
        console.log(`   Target Room: "${info.roomName}" (ID: ${TOKEN_ID_TO_BOOK})`);

        // 2. Check Balance (The #1 Cause of errors)
        const balance = await tokenContract.balanceOf(USER_ADDRESS, TOKEN_ID_TO_BOOK);
        console.log(`   User Balance: ${balance.toString()}`);

        if (balance == 0n) { // 0n is BigInt for 0
            console.error("\n❌ FAILURE CAUSE FOUND: INSUFFICIENT BALANCE");
            console.error(`   You are trying to book Room ID ${TOKEN_ID_TO_BOOK}, but you own 0 of them.`);
            console.error("   The Smart Contract reverts because it cannot pull a token you don't have.");
            console.error("\n   👉 FIX: Use the 'Mint' button (as Hotel Admin) to send a token to this wallet first.");
            return;
        }

        // 3. Check Approval (The #2 Cause of errors)
        const isApproved = await tokenContract.isApprovedForAll(USER_ADDRESS, BOOKING_MANAGER_ADDRESS);
        console.log(`   Contract Approved: ${isApproved}`);

        if (!isApproved) {
            console.error("\n❌ FAILURE CAUSE FOUND: NO APPROVAL");
            console.error("   You have the token, but you haven't given the BookingManager permission to move it.");
            console.error("\n   👉 FIX: The frontend should prompt you to 'Approve' before Booking.");
            console.error("   If it doesn't, ensure your frontend calls 'setApprovalForAll' before 'bookRoom'.");
            return;
        }

        console.log("\n✅ ALL CHECKS PASSED");
        console.log("   Balance is positive and Approval is granted.");
        console.log("   If it still fails, check the 'Blackout Date' API logic or gas settings.");

    } catch (error) {
        console.error("\n❌ SCRIPT ERROR:", error.message);
    }
}

main();
