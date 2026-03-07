const { ethers } = require('ethers');
const kmsClient = require('./kmsClient'); // Ensure this path is correct

// --- CONSTANTS FROM YOUR INDEX.JS ---
const FUND_AMOUNT = "0.01";
const MIN_BALANCE = "0.001";

async function testEnsureGas() {
    console.log("🚀 Starting Gas Funding Test...");

    try {
        // 1. Get the Admin Wallet (The Funder)
        const adminWallet = await kmsClient.getWallet();
        const provider = adminWallet.provider;
        console.log(`✅ Admin Wallet: ${adminWallet.address}`);
        
        const adminBalance = await provider.getBalance(adminWallet.address);
        console.log(`💰 Admin Balance: ${ethers.formatUnits(adminBalance, "ether")} POL`);

        // 2. Create a "User" Wallet (The Recipient) - Initially 0 POL
        const tempUserWallet = ethers.Wallet.createRandom(provider);
        console.log(`👤 Temp User Wallet: ${tempUserWallet.address}`);

        // 3. Check initial balance
        let balance = await provider.getBalance(tempUserWallet.address);
        console.log(`📉 Initial User Balance: ${ethers.formatUnits(balance, "ether")} POL`);

        // 4. Run the ensureGas Logic
        if (balance < ethers.parseEther(MIN_BALANCE)) {
            console.log(`⚡ Balance below ${MIN_BALANCE}. Triggering funding...`);
            
            const tx = await adminWallet.sendTransaction({ 
                to: tempUserWallet.address, 
                value: ethers.parseEther(FUND_AMOUNT) 
            });
            
            console.log("⏳ Waiting for transaction confirmation...");
            await tx.wait();
            console.log(`🔗 TX Hash: ${tx.hash}`);
        } else {
            console.log("✅ Balance is sufficient. No funding needed.");
        }

        // 5. Final Balance Check
        balance = await provider.getBalance(tempUserWallet.address);
        console.log(`📈 Final User Balance: ${ethers.formatUnits(balance, "ether")} POL`);

        if (parseFloat(ethers.formatUnits(balance, "ether")) >= parseFloat(FUND_AMOUNT)) {
            console.log("\n✨ TEST PASSED: User successfully funded!");
        } else {
            console.log("\n❌ TEST FAILED: Balance did not increase as expected.");
        }

    } catch (error) {
        console.error("\n❌ TEST ERROR:", error.message);
    }
}

testEnsureGas();
