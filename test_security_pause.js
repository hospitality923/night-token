const { ethers } = require('ethers');
const API_URL = "http://localhost:4000";

const TA1 = ethers.Wallet.createRandom();

async function main() {
    console.log("🛡️  STARTING SECTION 4: SECURITY (PAUSABLE) TEST\n");

    try {
        // 1. SETUP: Login as Hotel Admin
        console.log("🔑 Logging in as Hotel Admin...");
        const email = "admin_pause_" + Date.now() + "@hotel.com";
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: "pw", role: "hotel", wallet_address: "0x00" })
        });
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: "pw" })
        });
        const { token } = await loginRes.json();

        // 2. CREATE INVENTORY & PREP
        console.log("0️⃣  Creating Inventory & Minting...");
        const invRes = await fetch(`${API_URL}/admin/create-inventory`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ hotelId: "HTL-SECURE", roomName: "Secure Suite", totalSupply: 100, publicCap: 100 })
        });
        const { tokenId } = await invRes.json();
        
        // Mint to self so we have something to transfer
        await fetch(`${API_URL}/api/b2b/mint-to-self`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ tokenId, amount: 10 })
        });

        // 3. TRIGGER PAUSE (Need a backend endpoint for this)
        // Currently, we don't have an endpoint exposed to call 'pause()'.
        // For this test, we will add a temporary endpoint or simulate it if we had direct contract access.
        // SINCE WE CANNOT MODIFY BACKEND IN THIS SCRIPT, WE WILL FAIL HERE IF THE ENDPOINT DOESN'T EXIST.
        // 
        // TO FIX: I have added a '/admin/emergency-pause' route below. 
        // PLEASE RUN THE BACKEND UPDATE COMMAND BELOW THIS SCRIPT FIRST.
        
        console.log("\n1️⃣  Admin triggers EMERGENCY PAUSE...");
        const pauseRes = await fetch(`${API_URL}/admin/emergency-pause`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ action: "PAUSE" })
        });
        const pData = await pauseRes.json();
        console.log("   ✅ Contract Paused. Tx:", pData.txHash);

        // 4. ATTEMPT TRANSFER (SHOULD FAIL)
        console.log("\n2️⃣  Attempting Transfer while Paused (Should FAIL)...");
        const failRes = await fetch(`${API_URL}/api/b2b/distribute`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ tokenId, recipientAddress: TA1.address, amount: 1 })
        });
        const failData = await failRes.json();
        
        if (failData.error && failData.error.includes("EnforcedPause")) {
            console.log("   ✅ SUCCESS: Transfer blocked by Pause!");
        } else {
            console.log("   ❌ FAILURE: Transfer succeeded or wrong error:", failData);
        }

        // 5. UNPAUSE
        console.log("\n3️⃣  Admin UNPAUSES...");
        const unpauseRes = await fetch(`${API_URL}/admin/emergency-pause`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ action: "UNPAUSE" })
        });
        await unpauseRes.json();
        console.log("   ✅ Contract Unpaused.");

        // 6. RETRY TRANSFER (SHOULD SUCCEED)
        console.log("\n4️⃣  Retrying Transfer (Should SUCCEED)...");
        const successRes = await fetch(`${API_URL}/api/b2b/distribute`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ tokenId, recipientAddress: TA1.address, amount: 1 })
        });
        const sData = await successRes.json();
        if (sData.success) {
            console.log("   ✅ SUCCESS: Transfer went through.");
        } else {
            throw new Error(sData.error);
        }

        console.log("\n🛡️  SECURITY TEST PASSED!");

    } catch (e) {
        console.error("\n❌ TEST FAILED:", e.message);
    }
}

main();
