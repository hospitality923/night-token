require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

module.exports = {
  solidity: "0.8.20",
  networks: {
    amoy: {
      url: process.env.ALCHEMY_API_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.SERVER_PRIVATE_KEY ? [process.env.SERVER_PRIVATE_KEY] : [],
      chainId: 80002
    }
  },
  etherscan: {
    // Use the Unified Etherscan V2 Key here
    apiKey: "H42B3JIDJWMD6YIR2VNEVTHIYQIIMSJZS8",
    customChains: [
      {
        network: "amoy",
        chainId: 80002,
        urls: {
          // We use the PolygonScan endpoint because it infers the chainId
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  sourcify: {
    enabled: false
  }
};
