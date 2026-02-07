const { ethers } = require("ethers");

// --- CONFIGURATION ---
const USER_ADDRESS = "0xB844535AaF18be407A1fb96E646Bf8C2bdf6A181"; 
const BOOKING_MANAGER_ADDRESS = "0x1D3B95C292774D86556dc9DF70929845C2eb63fb";
const TOKEN_ADDRESS = "0x04f3DF3e63c5f3fCBEE561314F14351E065c7C3f";
const RPC_URL = "https://rpc-amoy.polygon.technology/";

const MANAGER_ABI = [
    "function bookRoom(uint256 _tokenId, uint256 _quantity, string _details) public"
];

async function main() {
    console.log(`\n🔍 SIMULATING TRANSACTION EXECUTION...`);
    console.log(`   User: ${USER_ADDRESS}`);
    console.log(`   Contract: ${BOOKING_MANAGER_ADDRESS}`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const iface = new ethers.Interface(MANAGER_ABI);

    // 1. Encode the exact function call you are trying to make
    const data = iface.encodeFunctionData("bookRoom", [
        1,              // Token ID
        1,              // Quantity
        "DEBUG_TEST"    // Details string
    ]);

    try {
        // 2. Perform a low-level "eth_call" simulation
        // This runs the code on the node without spending gas, returning the result or error.
        const result = await provider.call({
            to: BOOKING_MANAGER_ADDRESS,
            from: USER_ADDRESS, // We pretend to be YOU
            data: data,
            gasLimit: 500000
        });

        console.log("\n✅ SIMULATION SUCCESS!");
        console.log("   The contract accepted the transaction. No reverts detected.");
        console.log("   This means the contract logic is 100% fine.");
        console.log("\n   👉 THE PROBLEM IS YOUR BROWSER/RPC:");
        console.log("      1. Your browser might be using a stale or failing RPC node.");
        console.log("      2. Try hard-refreshing (Ctrl+F5) to ensure the latest 'gasLimit' fix is loaded.");
        console.log("      3. Increase Gas Limit in app.js to 600000 or 700000.");

    } catch (error) {
        console.error("\n❌ SIMULATION REVERTED!");
        console.error("   The contract rejected the transaction. Here is why:");
        
        // 3. Decode the error
        if (error.data) {
            // Try to decode standard string error
            try {
                const reason = iface.parseError(error.data);
                console.error(`   REASON: '${reason.name}' (Args: ${reason.args})`);
            } catch {
                try {
                    const str = ethers.toUtf8String('0x' + error.data.substring(138));
                    console.error(`   REASON: "${str}"`);
                } catch {
                    console.error(`   RAW ERROR DATA: ${error.data}`);
                    console.error("   (This usually means 'ERC1155: transfer to non ERC1155Receiver implementer')");
                }
            }
        } else {
            console.error(`   ERROR MESSAGE: ${error.message}`);
        }
        
        if (error.message.includes("transfer to non ERC1155Receiver")) {
             console.log("\n   🕵️ INTERPRETATION:");
             console.log("   The BookingManager contract is missing the 'onERC1155Received' function.");
             console.log("   You likely deployed a version that didn't inherit 'ERC1155Holder' correctly.");
        }
    }
}

main();
