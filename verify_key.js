const { ethers } = require("ethers");
    
    // The key from your .env
    const privateKey = "a5e6572d96fcf79998a5582e92a55993188af265fd1f488b89a736e4b613be9b";
    const wallet = new ethers.Wallet(privateKey);
    
    console.log("Private Key:", privateKey);
    console.log("Address:    ", wallet.address);
    
    if (wallet.address === "0x7392C805d955110edfB83F8569FD540d7197270B") {
        console.log("✅ MATCH! This is the correct key.");
    } else {
        console.log("❌ MISMATCH. This key belongs to a different address.");
    }
