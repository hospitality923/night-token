// Run this script to verify the backend "Invisible Wallet" flow.
// Usage: node test_backend_booking.js

const fetch = require('node-fetch'); // Needs node-fetch installed

const API_URL = "http://localhost:4000";

async function main() {
    console.log("🚀 STARTING INVISIBLE WALLET TEST...\n");

    try {
        // 1. Register a NEW User (Simulating a guest signing up with email)
        const email = "guest_" + Date.now() + "@hotel.com";
        const password = "securepassword";
        // We give them a random wallet address just for the record, 
        // but in a real "Invisible" app, the backend would generate this custodial wallet.
        const mockUserWallet = "0x" + Math.random().toString(16).slice(2, 42).padEnd(40, '0'); 
        
        console.log(`1️⃣  Registering User: ${email}`);
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password, role: "guest", wallet_address: mockUserWallet })
        });
        const regData = await regRes.json();
        if (regData.error) throw new Error(regData.error);
        console.log("   ✅ User Registered. ID:", regData.id);

        // 2. Login (Get JWT Token)
        console.log(`\n2️⃣  Logging In...`);
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json();
        if (loginData.error) throw new Error(loginData.error);
        const token = loginData.token;
        console.log("   ✅ Logged In. Token received.");

        // 3. Initialize Inventory (Simulate Admin creating "Black Box" supply)
        // We act as admin here (auth check is loose in MVP)
        console.log(`\n3️⃣  Initializing Inventory (The Black Box)...`);
        const invRes = await fetch(`${API_URL}/admin/create-inventory`, {
            method: 'POST', 
            headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({
                tokenId: 1, 
                hotelId: "HTL-TEST",
                roomName: "Invisible Suite",
                totalSupply: 100, // We say we have 100
                publicCap: 50
            })
        });
        const invData = await invRes.json();
        console.log("   ✅ Inventory Set:", invData.message);

        // 4. BOOK ROOM (The Magic Step)
        // The user clicks "Book" - NO METAMASK POPUP.
        console.log(`\n4️⃣  Attempting Invisible Booking...`);
        console.log("   (Backend should Mint -> Approve -> Book on-chain)");
        
        const bookRes = await fetch(`${API_URL}/api/book-invisible`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({
                tokenId: 1,
                date: "2025-12-31",
                guestName: "Mr. Invisible"
            })
        });
        
        const bookData = await bookRes.json();
        
        if (bookData.success) {
            console.log("\n🎉 SUCCESS! Booking Confirmed.");
            console.log("   Tx Hash:", bookData.txHash);
            console.log("   Message:", bookData.message);
            console.log("\n   View on Explorer: https://amoy.polygonscan.com/tx/" + bookData.txHash);
        } else {
            throw new Error(bookData.error);
        }

    } catch (e) {
        console.error("\n❌ TEST FAILED:", e.message);
    }
}

main();
