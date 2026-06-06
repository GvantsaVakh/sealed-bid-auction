import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { SealedBidAuction, SealedBidAuction__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

describe("SealedBidAuction", function () {
  let signers: Signers;
  let contract: SealedBidAuction;
  let contractAddress: string;

  const auctionDuration = 100;
  const itemName = "Rare NFT #42";

  async function submitEncryptedBid(bidder: HardhatEthersSigner, clearBid: number) {
    const encryptedBid = await fhevm.createEncryptedInput(contractAddress, bidder.address).add32(clearBid).encrypt();

    const tx = await contract.connect(bidder).submitBid(encryptedBid.handles[0], encryptedBid.inputProof);
    await tx.wait();
  }

  async function decryptHighestBid() {
    const encryptedHighestBid = await contract.getHighestBid();

    return await fhevm.userDecryptEuint(FhevmType.euint32, encryptedHighestBid, contractAddress, signers.deployer);
  }

  async function decryptWinnerId() {
    const encryptedWinnerId = await contract.getEncryptedWinnerId();

    return await fhevm.userDecryptEuint(FhevmType.euint32, encryptedWinnerId, contractAddress, signers.deployer);
  }

  async function finishAuction() {
    await time.increase(auctionDuration + 1);

    const tx = await contract.endAuction();
    await tx.wait();
  }

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();

    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test only runs in local mock mode");
      this.skip();
    }

    const factory = (await ethers.getContractFactory("SealedBidAuction")) as SealedBidAuction__factory;
    contract = (await factory.deploy(auctionDuration, itemName)) as SealedBidAuction;
    contractAddress = await contract.getAddress();
  });

  it("deploys with auction metadata and starts active", async function () {
    expect(await contract.owner()).to.eq(signers.deployer.address);
    expect(await contract.itemName()).to.eq(itemName);
    expect(await contract.hasAnyBid()).to.eq(false);
    expect(await contract.auctionEnded()).to.eq(false);
    expect(await contract.isActive()).to.eq(true);
  });

  it("rejects reading highest bid and winner before any bid exists", async function () {
    await expect(contract.getHighestBid()).to.be.revertedWithCustomError(contract, "NoBidYet");
    await expect(contract.getEncryptedWinnerId()).to.be.revertedWithCustomError(contract, "NoBidYet");
  });

  it("accepts encrypted bid while auction is active", async function () {
    await expect(submitEncryptedBid(signers.alice, 42)).to.not.be.rejected;

    expect(await contract.hasAnyBid()).to.eq(true);
    expect(await contract.hasBid(signers.alice.address)).to.eq(true);

    const highestBid = await decryptHighestBid();
    const winnerId = await decryptWinnerId();
    const winnerAddress = await contract.bidderById(winnerId);

    expect(highestBid).to.eq(42);
    expect(winnerAddress).to.eq(signers.alice.address);
  });

  it("tracks highest bid and winner across multiple encrypted bids", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);
    await submitEncryptedBid(signers.charlie, 50);

    const highestBid = await decryptHighestBid();
    const winnerId = await decryptWinnerId();
    const winnerAddress = await contract.bidderById(winnerId);

    expect(highestBid).to.eq(77);
    expect(winnerAddress).to.eq(signers.bob.address);
  });

  it("assigns stable bidder ids", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);

    expect(await contract.bidderIds(signers.alice.address)).to.eq(1);
    expect(await contract.bidderIds(signers.bob.address)).to.eq(2);
    expect(await contract.bidderById(1)).to.eq(signers.alice.address);
    expect(await contract.bidderById(2)).to.eq(signers.bob.address);
  });

  it("cannot end auction before deadline", async function () {
    await submitEncryptedBid(signers.alice, 42);

    await expect(contract.endAuction()).to.be.revertedWithCustomError(contract, "AuctionStillActive");
  });

  it("cannot end auction after deadline if no one has bid", async function () {
    await time.increase(auctionDuration + 1);

    await expect(contract.endAuction()).to.be.revertedWithCustomError(contract, "NoBidYet");
  });

  it("can end auction after deadline if bids exist", async function () {
    await submitEncryptedBid(signers.alice, 42);

    await finishAuction();

    expect(await contract.auctionEnded()).to.eq(true);
    expect(await contract.isActive()).to.eq(false);
  });

  it("cannot end auction twice", async function () {
    await submitEncryptedBid(signers.alice, 42);

    await finishAuction();

    await expect(contract.endAuction()).to.be.revertedWithCustomError(contract, "AuctionAlreadyFinalized");
  });

  it("rejects bids after auction deadline", async function () {
    await time.increase(auctionDuration + 1);

    const encryptedBid = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(42).encrypt();

    await expect(
      contract.connect(signers.alice).submitBid(encryptedBid.handles[0], encryptedBid.inputProof),
    ).to.be.revertedWithCustomError(contract, "AuctionAlreadyEnded");
  });

  it("finalizes auction and reveals Bob as winner in local test", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);
    await submitEncryptedBid(signers.charlie, 50);

    await finishAuction();

    const highestBid = await decryptHighestBid();
    const winnerId = await decryptWinnerId();
    const winnerAddress = await contract.bidderById(winnerId);

    expect(await contract.auctionEnded()).to.eq(true);
    expect(highestBid).to.eq(77);
    expect(winnerAddress).to.eq(signers.bob.address);
  });

  it("stores each bidder's encrypted bid separately", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);

    const aliceEncryptedBid = await contract.getEncryptedBid(signers.alice.address);
    const bobEncryptedBid = await contract.getEncryptedBid(signers.bob.address);

    const aliceBid = await fhevm.userDecryptEuint(FhevmType.euint32, aliceEncryptedBid, contractAddress, signers.alice);

    const bobBid = await fhevm.userDecryptEuint(FhevmType.euint32, bobEncryptedBid, contractAddress, signers.bob);

    expect(aliceBid).to.eq(42);
    expect(bobBid).to.eq(77);
  });
});
