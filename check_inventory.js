const { ethers } = require("ethers");

// --- CONFIGURATION ---
// Your RoomNightToken Address
const TOKEN_ADDRESS = "0x04f3DF3e63c5f3fCBEE561314F14351E065c7C3f"; 
// Your Wallet Address (Hotel Admin)
const MY_WALLET = "0x7392C805d955110edfB83F8569FD540d7197270B"; 

const RPC_URL = "https://rpc-amoy.polygon.technology/";

const ABI = [
    "function balanceOf(address account, uint256 id) view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(TOKEN_ADDRESS, ABI, provider);

    console.log(`\n🔍 Checking Inventory for Wallet: ${MY_WALLET}`);
    console.log(`   Contract: ${TOKEN_ADDRESS}`);
    console.log("------------------------------------------------");

    try {
        // Check Balance for Token ID 1
        const balance = await contract.balanceOf(MY_WALLET, 2);
        
        console.log(`Token ID 1 Balance: ${balance.toString()}`);
        console.log("------------------------------------------------");

        if (Number(balance) > 0) {
            console.log("✅ SUCCESS: You have inventory to sell!");
        } else {
            console.log("❌ RESULT: Balance is 0. Minting might have failed or is still pending.");
        }

    } catch (e) {
        console.error("Error reading contract:", e.message);
    }
    console.log("\n");
}

main();
