const { ethers } = require('ethers');
require('dotenv').config();

// Connects to Polygon Amoy
const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology/";
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY; 

// Simple safety check
if (!PRIVATE_KEY) {
    console.warn("⚠️  ADMIN_PRIVATE_KEY is missing in .env! Backend transactions will fail.");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
let wallet;

if (PRIVATE_KEY) {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
}

module.exports = {
    getWallet: async () => {
        if (!wallet) throw new Error("Admin Wallet not configured");
        return wallet;
    },
    getAddress: async () => {
        if (!wallet) return null;
        return wallet.address;
    }
};
