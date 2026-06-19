import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { EncryptedAuctionWithWinner, EncryptedAuctionWithWinner__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

describe("EncryptedAuctionWithWinner", function () {
  let signers: Signers;
  let contract: EncryptedAuctionWithWinner;
  let contractAddress: string;

  const auctionDuration = 100;
  const itemName = "Test NFT";

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

    const factory = (await ethers.getContractFactory(
      "EncryptedAuctionWithWinner",
    )) as EncryptedAuctionWithWinner__factory;

    contract = (await factory.deploy(auctionDuration, itemName)) as EncryptedAuctionWithWinner;
    contractAddress = await contract.getAddress();
  });

  it("deploys with auction metadata", async function () {
    expect(await contract.owner()).to.eq(signers.deployer.address);
    expect(await contract.itemName()).to.eq(itemName);
    expect(await contract.hasAnyBid()).to.eq(false);
    expect(await contract.isActive()).to.eq(true);
  });

  it("reverts when reading winner before any bid exists", async function () {
    await expect(contract.getEncryptedWinnerId()).to.be.revertedWithCustomError(contract, "NoBidYet");
  });

  it("sets first bidder as encrypted winner", async function () {
    await submitEncryptedBid(signers.alice, 42);

    const highestBid = await decryptHighestBid();
    const winnerId = await decryptWinnerId();
    const winnerAddress = await contract.bidderById(winnerId);

    expect(highestBid).to.eq(42);
    expect(winnerAddress).to.eq(signers.alice.address);
  });

  it("updates encrypted winner when Bob bids higher than Alice", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);

    const highestBid = await decryptHighestBid();
    const winnerId = await decryptWinnerId();
    const winnerAddress = await contract.bidderById(winnerId);

    expect(highestBid).to.eq(77);
    expect(winnerAddress).to.eq(signers.bob.address);
  });

  it("keeps Bob as winner when Charlie bids lower", async function () {
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

  it("rejects bids after auction ends", async function () {
    await time.increase(auctionDuration + 1);

    const encryptedBid = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(42).encrypt();

    await expect(
      contract.connect(signers.alice).submitBid(encryptedBid.handles[0], encryptedBid.inputProof),
    ).to.be.revertedWithCustomError(contract, "AuctionAlreadyEnded");
  });
});
