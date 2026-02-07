const { ethers } = require('ethers');
const API_URL = "http://localhost:4000";

const TA1 = ethers.Wallet.createRandom();
const TA2 = ethers.Wallet.createRandom();

// Helper to simulate "Offline Payment" delay
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("🏨 STARTING SECTION 5 PILOT DEMO (FULL ESCROW FLOW)\n");
    console.log("🎭 ACTORS:");
    console.log("   TA1 Address:", TA1.address);
    console.log("   TA2 Address:", TA2.address);

    try {
        // --- LOGIN AS ADMIN ---
        console.log("\n🔑 Logging in as Hotel Admin...");
        const email = "admin_b2b_" + Date.now() + "@hotel.com";
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: "pw", role: "hotel", wallet_address: "0x00" })
        });
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: "pw" })
        });
        const { token } = await loginRes.json();


        // --- STEP 0: CREATE INVENTORY ---
        console.log("\n0️⃣  Creating Inventory...");
        const invRes = await fetch(`${API_URL}/admin/create-inventory`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ hotelId: "HTL-ESCROW", roomName: "Escrow Suite", totalSupply: 100, publicCap: 100 })
        });
        const invData = await invRes.json();
        const REAL_TOKEN_ID = invData.tokenId;
        console.log("   ✅ Inventory ID:", REAL_TOKEN_ID);

        // PREP: Hotel JIT-Mints tokens to ITSELF first so it can sell them via Escrow
        // (If we used 'distribute', it would go direct to TA1, skipping escrow)
        console.log("   -> Hotel JIT-Mints 20 tokens to self (for Escrow sale)...");
        await fetch(`${API_URL}/api/b2b/mint-to-self`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ tokenId: REAL_TOKEN_ID, amount: 20 })
        });


        // --- STEP 1: PRIMARY MARKET (Hotel -> TA1 via Escrow) ---
        // Hotel creates sales (deposit into escrow) [cite: 26]
        console.log(`\n1️⃣  Primary Market: Selling 20 nights to TA1 (Escrow)...`);
        
        // A. DEPOSIT (Hotel Deposits)
        // Since Hotel = Admin, we use a slightly different flow or assume Admin Key.
        // For simplicity in this script, we assume the backend handles the "Hotel's" deposit 
        // using its internal Admin Key when we call a specific endpoint, OR we simulate it 
        // by having the Hotel send to the Escrow Vault directly if we had their key.
        // 
        // CRITICAL SHORTCUT FOR DEMO: 
        // Since 'mint-to-self' put tokens in the Admin Wallet (which IS the Escrow Vault),
        // the "Deposit" is effectively done. The Admin *has* the tokens. 
        // We just need to logically "Release" them to TA1 after payment.
        
        console.log("   [Escrow] Assets are locked (held by Admin).");
        
        // B. PAYMENT
        console.log("   ( 💸 TA1 sends Offline Payment... )");
        // TA1 pays offline [cite: 27]
        await wait(1000);
        
        // C. RELEASE (Hotel Releases to TA1)
        console.log("   -> Hotel Confirms Payment & Releases to TA1...");
        // Hotel confirms receipt and releases assets [cite: 28]
        const rel1 = await fetch(`${API_URL}/api/escrow/release`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ 
                tradeId: "TRADE_1", // Mock ID
                buyerAddress: TA1.address, 
                tokenId: REAL_TOKEN_ID, 
                amount: 20,
                isRedemption: false 
            })
        });
        const d1 = await rel1.json();
        if(d1.error) throw new Error(d1.error);
        console.log("   ✅ TA1 Received 20 Tokens. Tx:", d1.txHash);


        // --- STEP 2: SECONDARY MARKET (TA1 -> TA2 via Escrow) ---
        // TA1 resells to TA2 using the same escrow process [cite: 45]
        console.log(`\n2️⃣  Secondary Market: TA1 sells 5 nights to TA2 (Escrow)...`);
        
        // A. DEPOSIT (TA1 Deposits to Escrow Vault)
        console.log("   -> TA1 Deposits 5 tokens to Escrow...");
        const dep2 = await fetch(`${API_URL}/api/escrow/deposit`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sellerPrivateKey: TA1.privateKey, 
                buyerAddress: TA2.address, 
                tokenId: REAL_TOKEN_ID, 
                amount: 5 
            })
        });
        const d2 = await dep2.json();
        if(d2.error) throw new Error(d2.error);
        const TRADE_ID_2 = d2.tradeId;
        console.log("   ✅ Assets Locked. Trade ID:", TRADE_ID_2);

        // B. PAYMENT
        console.log("   ( 💸 TA2 sends Offline Payment... )");
        await wait(1000);

        // C. RELEASE (TA1 Releases to TA2)
        // Note: Ideally TA1 calls this. In our simplified backend 'release' is an Admin-only function (authMiddleware).
        // This implies the PLATFORM handles the release after TA1 clicks "Confirm" in the UI.
        console.log("   -> TA1 Confirms Payment (via Platform) & Release triggers...");
        // TA1 confirms receipt and TA2 receives tokens [cite: 46]
        const rel2 = await fetch(`${API_URL}/api/escrow/release`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ 
                tradeId: TRADE_ID_2, 
                buyerAddress: TA2.address, 
                tokenId: REAL_TOKEN_ID, 
                amount: 5,
                isRedemption: false 
            })
        });
        const d3 = await rel2.json();
        if(d3.error) throw new Error(d3.error);
        console.log("   ✅ TA2 Received 5 Tokens. Tx:", d3.txHash);


        // --- STEP 3: REDEMPTION (TA2 -> Redemption Escrow) ---
        // TA2 initiates redemption request [cite: 48]
        // "Redemption" is also an escrow flow: Deposit -> Hotel Confirms Stay -> Release (Burn)
        console.log(`\n3️⃣  Redemption: TA2 redeems 1 night (Escrow Flow)...`);

        // A. DEPOSIT (TA2 Deposits for Redemption)
        console.log("   -> TA2 Deposits 1 token for Redemption...");
        const dep3 = await fetch(`${API_URL}/api/escrow/deposit`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sellerPrivateKey: TA2.privateKey, 
                buyerAddress: "0x0000000000000000000000000000000000000000", // Burn destination
                tokenId: REAL_TOKEN_ID, 
                amount: 1 
            })
        });
        const d4 = await dep3.json();
        if(d4.error) throw new Error(d4.error);
        const TRADE_ID_3 = d4.tradeId;
        console.log("   ✅ Assets Locked for Redeem. Trade ID:", TRADE_ID_3);

        // B. SERVICE DELIVERY
        console.log("   ( 🏨 Guest Stays at Hotel... )");
        await wait(1000);

        // C. RELEASE (Hotel Confirms Stay -> Burn)
        // Listener service captures event and records success [cite: 49]
        console.log("   -> Hotel Confirms Stay & Burns Token...");
        const rel3 = await fetch(`${API_URL}/api/escrow/release`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ 
                tradeId: TRADE_ID_3, 
                buyerAddress: "0x00", 
                tokenId: REAL_TOKEN_ID, 
                amount: 1,
                isRedemption: true // Triggers Burn
            })
        });
        const d5 = await rel3.json();
        if(d5.error) throw new Error(d5.error);
        console.log("   ✅ Token Burned. Redemption Complete. Tx:", d5.txHash);

        console.log("\n🎉 FULL ESCROW PILOT DEMO SUCCESSFUL!");
        console.log("View transactions on: https://amoy.polygonscan.com/");

    } catch (e) {
        console.error("\n❌ TEST FAILED:", e.message);
    }
}

main();
