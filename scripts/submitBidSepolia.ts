import { ethers, fhevm } from "hardhat";

async function main() {
  await fhevm.initializeCLIApi();

  const contractAddress = "0x89123AEddA7706df3F4cDC4c37F73DcdE53b4377";
  const bidAmount = 42;

  const [bidder] = await ethers.getSigners();
  const auction = await ethers.getContractAt("SealedBidAuction", contractAddress);

  console.log("Bidder:", bidder.address);
  console.log("Contract:", contractAddress);
  console.log("Plaintext bid locally before encryption:", bidAmount);

  const encryptedBid = await fhevm.createEncryptedInput(contractAddress, bidder.address).add32(bidAmount).encrypt();

  const tx = await auction.connect(bidder).submitBid(encryptedBid.handles[0], encryptedBid.inputProof);

  console.log("submitBid tx:", tx.hash);

  const receipt = await tx.wait();

  console.log("Bid submitted successfully on Sepolia");
  console.log("Confirmed in block:", receipt?.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
