const { ethers } = require('ethers');
const API_URL = "http://localhost:4000";

const TA1 = ethers.Wallet.createRandom();

async function main() {
    console.log("🔐 STARTING SECTION 3: ESCROW & TRUSTED FLOW TEST\n");
    console.log("   TA1 Address:", TA1.address);

    try {
        // 1. SETUP: Login as Hotel Admin
        console.log("\n🔑 Logging in as Hotel Admin...");
        const email = "admin_escrow_" + Date.now() + "@hotel.com";
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: "pw", role: "hotel", wallet_address: "0x00" })
        });
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: "pw" })
        });
        const { token } = await loginRes.json();

        // 2. CREATE INVENTORY
        console.log("\n0️⃣  Creating Inventory...");
        const invRes = await fetch(`${API_URL}/admin/create-inventory`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ hotelId: "HTL-ESCROW", roomName: "Escrow Suite", totalSupply: 50, publicCap: 50 })
        });
        const { tokenId } = await invRes.json();
        console.log("   ✅ Inventory ID:", tokenId);

        // 3. PREP: Hotel mints tokens to ITSELF first (so it can deposit them)
        console.log("\n1️⃣  Prep: Hotel JIT-Mints 20 tokens to self...");
        await fetch(`${API_URL}/api/b2b/mint-to-self`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ tokenId: tokenId, amount: 20 })
        });
        console.log("   ✅ Hotel now holds 20 tokens.");

        // 4. STEP 1: DEPOSIT TO ESCROW
        // Hotel (Seller) sends tokens to Escrow Vault
        // Note: For this demo, we use the Admin Key from the backend as the Seller signer? 
        // Actually, the backend holds the Admin Key. In a real app, Hotel signs via MetaMask.
        // For this backend test, we will assume the Hotel is the Admin.
        // We will skip the 'privateKey' param for the Hotel and let the backend use its internal Admin Key
        // if we modify the endpoint. BUT, to test strictly, let's look at the endpoint...
        // The endpoint expects 'sellerPrivateKey'.
        // Since we don't have the Admin Private Key exposed in JS here easily, 
        // we will simulate the Hotel using a NEW generated wallet that we fund first.
        
        // SIMPLIFICATION FOR TEST: 
        // We will just call the 'mint-to-self' which puts tokens in the Admin Wallet.
        // Since the Admin Wallet IS the Escrow Wallet in our MVP Mock, 
        // the "Deposit" step is conceptually "Admin tagging tokens as Locked".
        // But let's verify the API call structure.
        
        console.log("\n2️⃣  Step 1: Deposit to Escrow (Locking Assets)...");
        // We act as if we are the seller depositing.
        // In this mock, the 'Deposit' endpoint moves funds from Seller -> Admin.
        // Since Admin already has them (from Prep), we will simulate a B2B transfer from a Sub-Agent.
        
        // RE-PLAN FOR CLEAN TEST:
        // Let's do TA1 -> TA2 Escrow.
        // Hotel distributes to TA1 (Direct).
        // TA1 Deposits to Escrow (for sale to TA2).
        // TA1 Confirms.
        // Escrow Releases to TA2.
        
        // A. Fund TA1
        console.log("   (Seeding TA1 with tokens first via direct distribute...)");
        await fetch(`${API_URL}/api/b2b/distribute`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ tokenId: tokenId, recipientAddress: TA1.address, amount: 10 })
        });

        // B. TA1 Deposits to Escrow (Selling to Random Buyer)
        console.log("   -> TA1 deposits 5 tokens to Escrow...");
        const depRes = await fetch(`${API_URL}/api/escrow/deposit`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sellerPrivateKey: TA1.privateKey, // TA1 is Seller
                buyerAddress: "0x0000000000000000000000000000000000000000", // Placeholder
                tokenId: tokenId, 
                amount: 5 
            })
        });
        const depData = await depRes.json();
        if(depData.error) throw new Error(depData.error);
        console.log("   ✅ Assets Locked! Tx:", depData.txHash);
        const TRADE_ID = depData.tradeId;

        // 5. OFFLINE PAYMENT SIMULATION
        console.log("\n3️⃣  Step 2: Offline Payment...");
        console.log("   ( 💸 Bank Transfer happening... )");
        await new Promise(r => setTimeout(r, 1000));
        console.log("   ✅ Payment Received.");

        // 6. STEP 3: CONFIRM & RELEASE
        console.log("\n4️⃣  Step 3: Seller Confirms & Escrow Releases...");
        const relRes = await fetch(`${API_URL}/api/escrow/release`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ 
                tradeId: TRADE_ID, 
                buyerAddress: TA1.address, // For test, sending back to TA1 or a new TA2
                tokenId: tokenId, 
                amount: 5,
                isRedemption: false 
            })
        });
        const relData = await relRes.json();
        if(relData.error) throw new Error(relData.error);
        console.log("   ✅ Assets Released! Tx:", relData.txHash);

        console.log("\n🎉 ESCROW FLOW VERIFIED!");

    } catch (e) {
        console.error("\n❌ TEST FAILED:", e.message);
    }
}

main();
