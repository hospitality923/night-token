const { ethers } = require("ethers");

// --- CONFIGURATION ---
// This is your NEW RoomNightToken Address
const TOKEN_ADDRESS = "0x04f3DF3e63c5f3fCBEE561314F14351E065c7C3f"; 
const RPC_URL = "https://rpc-amoy.polygon.technology/";

const ABI = [
    "function roomTypeInfo(uint256 id) view returns (string hotelId, string roomName, bool isDefined)",
    "function nextTokenId() view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(TOKEN_ADDRESS, ABI, provider);

    console.log(`\n🔍 Checking Room Type #1 on Contract: ${TOKEN_ADDRESS}`);
    console.log("------------------------------------------------");

    try {
        // 1. Check the Counter (How many types have been created?)
        const nextId = await contract.nextTokenId();
        console.log(`Next Token ID Counter: ${nextId}`);

        // 2. Check ID 1 specifically
        const info = await contract.roomTypeInfo(1);
        
        console.log(`\n--- Token ID 1 Data ---`);
        console.log(`Hotel Code:  ${info.hotelId}`);
        console.log(`Room Name:   ${info.roomName}`);
        console.log(`Is Defined?  ${info.isDefined}`);
        console.log("------------------------------------------------");

        if (info.isDefined === false) {
            console.log("❌ RESULT: Token ID 1 DOES NOT EXIST.");
            console.log("👉 Solution: You MUST go to '1. Define New Room Type' in the UI and create it.");
        } else {
            console.log("✅ RESULT: Token ID 1 exists.");
        }

    } catch (e) {
        console.error("Error reading contract:", e.message);
    }
    console.log("\n");
}

main();
