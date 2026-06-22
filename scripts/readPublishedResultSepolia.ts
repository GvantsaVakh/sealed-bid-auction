import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x40c7570CFFD13518f4f96d89CB3aAE197C40dcd2";

  const auction = await ethers.getContractAt("SealedBidAuction", contractAddress);

  console.log("resultPublished:", await auction.resultPublished());
  console.log("publicWinnerId:", (await auction.publicWinnerId()).toString());
  console.log("publicWinner:", await auction.publicWinner());
  console.log("publicHighestBid:", (await auction.publicHighestBid()).toString());
  console.log("publicVickreyPrice:", (await auction.publicVickreyPrice()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
