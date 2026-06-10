import { ethers, fhevm } from "hardhat";

async function main() {
  await fhevm.initializeCLIApi();

  const contractAddress = "0xC9C4013e5C46F46c0e8E62365d7A286EBB0c479C";
  const bidAmount = 42;

  const [bidder] = await ethers.getSigners();
  const auction = await ethers.getContractAt("SealedBidAuction", contractAddress);

  console.log("Bidder:", bidder.address);
  console.log("Contract:", contractAddress);
  console.log("Bid:", bidAmount);

  const encryptedBid = await fhevm.createEncryptedInput(contractAddress, bidder.address).add32(bidAmount).encrypt();

  const tx = await auction.connect(bidder).submitBid(encryptedBid.handles[0], encryptedBid.inputProof);

  console.log("submitBid tx:", tx.hash);

  await tx.wait();

  console.log("Bid submitted successfully on Sepolia");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
