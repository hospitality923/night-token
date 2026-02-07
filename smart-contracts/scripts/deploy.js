const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy Token
  // The RoomNightToken constructor now expects: (address initialOwner, string memory _uri)
  const RoomNightToken = await hre.ethers.getContractFactory("RoomNightToken");
  
  // FIX: Pass the 2 required arguments
  const initialURI = "https://api.nightprotocol.com/metadata/"; 
  const token = await RoomNightToken.deploy(deployer.address, initialURI);
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("RoomNightToken deployed to:", tokenAddress);

  // 2. Deploy Escrow
  const TokenEscrow = await hre.ethers.getContractFactory("TokenEscrow");
  const escrow = await TokenEscrow.deploy(tokenAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("TokenEscrow deployed to:", escrowAddress);

  // 3. Deploy Booking Manager
  const BookingManager = await hre.ethers.getContractFactory("BookingManager");
  const manager = await BookingManager.deploy(tokenAddress);
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("BookingManager deployed to:", managerAddress);

  console.log("\n--- CONFIGURATION FOR APP.JS ---");
  console.log(`let TOKEN_ADDRESS = "${tokenAddress}";`);
  console.log(`let ESCROW_ADDRESS = "${escrowAddress}";`);
  console.log(`let BOOKING_MANAGER_ADDRESS = "${managerAddress}";`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
