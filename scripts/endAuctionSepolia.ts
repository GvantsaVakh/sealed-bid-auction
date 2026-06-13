import { ethers } from "hardhat";

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Set CONTRACT_ADDRESS");
  }

  const auction = await ethers.getContractAt("SealedBidAuction", contractAddress);

  console.log("Ending auction:", contractAddress);

  const tx = await auction.endAuction();

  console.log("endAuction tx:", tx.hash);
  await tx.wait();

  console.log("Auction finalized. Gateway reveal requested.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
