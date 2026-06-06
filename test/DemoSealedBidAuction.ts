import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, fhevm } from "hardhat";
import { SealedBidAuction, SealedBidAuction__factory } from "../types";

async function submitEncryptedBid(
  contract: SealedBidAuction,
  contractAddress: string,
  bidder: HardhatEthersSigner,
  bidderName: string,
  clearBid: number,
) {
  console.log(`\n${bidderName} prepares bid: ${clearBid}`);
  console.log(`${bidderName} encrypts the bid locally before sending it on-chain.`);

  const encryptedBid = await fhevm.createEncryptedInput(contractAddress, bidder.address).add32(clearBid).encrypt();

  console.log(`Public observer sees encrypted handle only: ${encryptedBid.handles[0]}`);

  const tx = await contract.connect(bidder).submitBid(encryptedBid.handles[0], encryptedBid.inputProof);
  await tx.wait();

  console.log(`${bidderName} submitted encrypted bid. Tx hash: ${tx.hash}`);
}

describe("Demo: SealedBidAuction", function () {
  it("runs the full sealed-bid auction flow", async function () {
    if (!fhevm.isMock) {
      console.warn("This demo is designed for local Hardhat mock mode.");
      this.skip();
    }

    const [deployer, alice, bob, charlie] = await ethers.getSigners();

    const auctionDuration = 100;
    const itemName = "Rare NFT #42";

    console.log("\nDeploying SealedBidAuction...");
    console.log(`Auction item: ${itemName}`);

    const factory = (await ethers.getContractFactory("SealedBidAuction")) as SealedBidAuction__factory;
    const contract = (await factory.deploy(auctionDuration, itemName)) as SealedBidAuction;
    const contractAddress = await contract.getAddress();

    console.log(`SealedBidAuction deployed at: ${contractAddress}`);
    console.log(`Owner/deployer: ${deployer.address}`);
    console.log("\nAuction is active:", await contract.isActive());

    console.log("\n--- Bidding phase ---");

    await submitEncryptedBid(contract, contractAddress, alice, "Alice", 42);
    await submitEncryptedBid(contract, contractAddress, bob, "Bob", 77);
    await submitEncryptedBid(contract, contractAddress, charlie, "Charlie", 50);

    console.log("\nAt this point, all bid values were submitted as encrypted inputs.");
    console.log("The contract compared encrypted bids using FHE.gt and FHE.select.");
    console.log("Public observers can see transactions, but not plaintext bid amounts.");

    console.log("\n--- Finalization phase ---");

    console.log("Moving blockchain time forward until auction deadline passes...");
    await time.increase(auctionDuration + 1);

    const endTx = await contract.endAuction();
    await endTx.wait();

    console.log(`Auction finalized. Tx hash: ${endTx.hash}`);
    console.log("Auction ended:", await contract.auctionEnded());
    console.log("Auction is active:", await contract.isActive());

    console.log("\n--- Local mock reveal for demo/testing ---");

    const encryptedHighestBid = await contract.getHighestBid();
    const encryptedWinnerId = await contract.getEncryptedWinnerId();

    const winningBid = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedHighestBid, contractAddress, deployer);

    const winnerId = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedWinnerId, contractAddress, deployer);

    const winnerAddress = await contract.bidderById(winnerId);

    console.log(`Winning bid: ${winningBid}`);
    console.log(`Winner id: ${winnerId}`);
    console.log(`Winner address: ${winnerAddress}`);

    if (winnerAddress.toLowerCase() === bob.address.toLowerCase()) {
      console.log("\nResult: Bob wins, as expected, because 77 was the highest bid.");
    } else {
      throw new Error("Unexpected result: winner is not Bob.");
    }

    console.log("\nDemo complete.");
  });
});
