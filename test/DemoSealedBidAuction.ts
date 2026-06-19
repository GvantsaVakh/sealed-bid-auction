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
  console.log(`\n${bidderName} prepares private bid: ${clearBid}`);
  console.log(`${bidderName} encrypts the bid locally before sending it on-chain.`);

  const encryptedBid = await fhevm.createEncryptedInput(contractAddress, bidder.address).add32(clearBid).encrypt();

  console.log(`Public observer sees encrypted handle only: ${encryptedBid.handles[0]}`);

  const tx = await contract.connect(bidder).submitBid(encryptedBid.handles[0], encryptedBid.inputProof);
  await tx.wait();

  console.log(`${bidderName} submitted encrypted bid. Tx hash: ${tx.hash}`);
}

describe("Demo: Confidential Vickrey Sealed-Bid Auction", function () {
  it("runs the full confidential second-price auction flow", async function () {
    if (!fhevm.isMock) {
      console.warn("This demo is designed for local Hardhat mock mode.");
      this.skip();
    }

    const [deployer, alice, bob, charlie] = await ethers.getSigners();

    const auctionDuration = 100;
    const itemName = "Rare NFT #42";

    console.log("\n==================================================");
    console.log(" Confidential Vickrey Auction Demo");
    console.log("==================================================");

    console.log("\nDeploying SealedBidAuction...");
    console.log(`Auction item: ${itemName}`);
    console.log("Auction type: sealed-bid second-price / Vickrey auction");
    console.log("Rule: highest bidder wins, but pays the second-highest bid.");

    const factory = (await ethers.getContractFactory("SealedBidAuction")) as SealedBidAuction__factory;
    const contract = (await factory.deploy(auctionDuration, itemName)) as SealedBidAuction;
    const contractAddress = await contract.getAddress();

    console.log(`\nSealedBidAuction deployed at: ${contractAddress}`);
    console.log(`Owner/deployer: ${deployer.address}`);
    console.log("Auction is active:", await contract.isActive());
    console.log("Initial bid count:", await contract.bidCount());

    console.log("\n==================================================");
    console.log(" Bidding phase");
    console.log("==================================================");

    await submitEncryptedBid(contract, contractAddress, alice, "Alice", 42);
    await submitEncryptedBid(contract, contractAddress, bob, "Bob", 77);
    await submitEncryptedBid(contract, contractAddress, charlie, "Charlie", 50);

    console.log("\nBid count after submissions:", await contract.bidCount());

    console.log("\nAt this point:");
    console.log("- Alice, Bob, and Charlie have submitted bids.");
    console.log("- The plaintext bid values are not stored publicly.");
    console.log("- Public observers see transactions and encrypted handles only.");
    console.log("- The contract updates the encrypted highest bid using FHE.gt and FHE.select.");
    console.log("- The contract also tracks the encrypted second-highest bid for Vickrey pricing.");

    console.log("\nExpected hidden bids for demo:");
    console.log("- Alice bid: 42");
    console.log("- Bob bid: 77");
    console.log("- Charlie bid: 50");
    console.log("\nExpected Vickrey result:");
    console.log("- Winner should be Bob, because 77 is the highest bid.");
    console.log("- Final price should be 50, because 50 is the second-highest bid.");

    console.log("\n==================================================");
    console.log(" Finalization phase");
    console.log("==================================================");

    console.log("\nMoving blockchain time forward until auction deadline passes...");
    await time.increase(auctionDuration + 1);

    const endTx = await contract.endAuction();
    await endTx.wait();

    console.log(`Auction finalized. Tx hash: ${endTx.hash}`);
    console.log("Auction ended:", await contract.auctionEnded());
    console.log("Auction is active:", await contract.isActive());

    console.log("\n==================================================");
    console.log(" Local mock reveal for demo/testing");
    console.log("==================================================");

    const encryptedHighestBid = await contract.getHighestBid();
    const encryptedSecondHighestBid = await contract.getSecondHighestBid();
    const encryptedWinnerId = await contract.getEncryptedWinnerId();

    const highestBid = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedHighestBid, contractAddress, deployer);

    const secondHighestBid = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedSecondHighestBid,
      contractAddress,
      deployer,
    );

    const winnerId = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedWinnerId, contractAddress, deployer);

    const winnerAddress = await contract.bidderById(winnerId);

    console.log(`Highest bid: ${highestBid}`);
    console.log(`Second-highest bid / Vickrey price: ${secondHighestBid}`);
    console.log(`Winner id: ${winnerId}`);
    console.log(`Winner address: ${winnerAddress}`);

    if (winnerAddress.toLowerCase() !== bob.address.toLowerCase()) {
      throw new Error("Unexpected result: winner is not Bob.");
    }

    if (highestBid !== 77n) {
      throw new Error(`Unexpected highest bid: expected 77, got ${highestBid}`);
    }

    if (secondHighestBid !== 50n) {
      throw new Error(`Unexpected second-highest bid: expected 50, got ${secondHighestBid}`);
    }

    console.log("\nFinal result:");
    console.log("Bob wins because he submitted the highest encrypted bid: 77.");
    console.log("But because this is a Vickrey auction, Bob does not pay 77.");
    console.log("Bob pays the second-highest bid instead: 50.");
    console.log("\nThis demonstrates that the contract privately computed:");
    console.log("- the highest encrypted bid");
    console.log("- the second-highest encrypted bid");
    console.log("- the encrypted winner id");
    console.log("\nDemo complete.");
  });
});
